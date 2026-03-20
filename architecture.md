# Architecture: Data Flows

This document traces how data moves through the app — from GitHub into the UI,
and back to GitHub on mutations.

## Overview

The app uses a three-layer architecture:

1. **Main process** (Node.js) — database, syncing, GitHub API calls.
2. **Preload bridge** — secure IPC gateway via Electron's `contextBridge`.
3. **Renderer process** (React + Redux) — UI and local state management.

Two communication channels connect the renderer to the main process:

- **IPC** (`ipcRenderer.invoke` / `ipcRenderer.on`) — for bootstrap data and
  push events (`ResourceUpdated`, `SyncComplete`). Channels defined in
  `src/lib/ipc/channels.ts`, bridged via `src/preload.ts`.
- **HTTP** (`fetch` to `localhost:{port}`) — for mutations (reviews, comments)
  and data reads (PR details, sync triggers). Served by a Hono HTTP server
  running in the main process (`src/main/api/server.ts`).

---

## 1. Reads: GitHub → Syncer → Database → Redux → UI

### Startup sequence

Defined in `src/main.ts`:

```
app.on('ready')
├─ initializeDatabase()
├─ startApiServer(loadToken)          # Hono on random port
├─ getUserLogin()
├─ bootstrap(userLogin)               # SQLite → BootstrapData (flat arrays)
├─ createWindow()
├─ backgroundSyncer.start(loadToken)
└─ syncPullRequests(token)            # GraphQL search (startup + title bar refresh)
   ├─ syncStalePullRequests()         # Prune closed/merged PRs
   ├─ send ResourceUpdated { type: 'pull-requests', data }
   ├─ send SyncComplete              # Signal to renderer (no data)
   └─ syncAllPullRequestDetails()    # REST per-PR (if stale)
      └─ per PR: sendPullRequestResourceEvents()  # Data-carrying events
```

There is **no** periodic timer for the PR list; users refresh explicitly from the
title bar (or restart the app).

### Bootstrap

`src/main/bootstrap.ts` reads all tables from SQLite and builds a
`BootstrapData` object with flat arrays:

```typescript
interface BootstrapData {
  checks: Check[]
  comments: Comment[]
  commits: Commit[]
  modifiedFiles: ModifiedFile[]
  pendingReviews: Record<string, PendingReview>
  pullRequests: PullRequest[]
  reactions: CommentReaction[]
  reviews: Review[]
}
```

Each `PullRequest` includes computed counts (approvals, changes requested,
comments) and relation flags (`isAuthor`, `isAssignee`, `isReviewer`). The flat
arrays contain all items across all PRs, each tagged with a `pullRequestId`.

### Renderer bootstrap

`src/renderer.tsx`:

1. Calls `window.electron.getBootstrapData()` via IPC.
2. Filters PRs to only "ready" ones (those with `detailsSyncedAt` set).
3. Creates the Redux store with preloaded state, initializing each flat slice
   from the corresponding bootstrap array.

### Background syncer

`src/main/background-syncer.ts` is **separate** from the GitHub PR **list** sync
(`syncPullRequests` in `src/sync/pull-requests.ts`). It only refreshes **CI check
statuses** for PRs the user has opened in the app (“active” PRs):

- **With running checks:** every 2 seconds.
- **Without running checks:** every 10 seconds.

It does **not** re-fetch the home-page PR list from GitHub; that is handled by
`runPullRequestSync()` in `src/main.ts` (on startup, and on demand via the title
bar refresh — IPC `RequestPullRequestSync`).

After each checks cycle it sends data-carrying `ResourceUpdated` events (checks
and pull-request summary) via `notifyRenderer()`.

A PR becomes active when the renderer calls
`POST /api/pull-requests/{id}/activate`, which calls
`backgroundSyncer.markPullRequestActive()` and schedules an immediate sync cycle.

### IPC event listeners

`src/app/App.tsx` registers two listeners:

**`onResourceUpdated`** — fired when resource data changes (after a mutation,
background sync, or detail sync). The event carries the data in its payload as a
discriminated union (`ResourceUpdatedEvent` from `src/types/ipc-events.ts`):

```typescript
type ResourceUpdatedEvent =
  | { type: 'checks'; pullRequestId: string; data: Check[] }
  | { type: 'comments'; pullRequestId: string; data: Comment[] }
  | { type: 'commits'; pullRequestId: string; data: Commit[] }
  | { type: 'modified-files'; pullRequestId: string; data: ModifiedFile[] }
  | {
      type: 'pending-review'
      pullRequestId: string
      data: PendingReview | null
    }
  | { type: 'pull-request'; pullRequestId: string; data: PullRequest }
  | { type: 'pull-requests'; data: PullRequest[] }
  | { type: 'reactions'; pullRequestId: string; data: CommentReaction[] }
  | { type: 'reviews'; pullRequestId: string; data: Review[] }
```

The handler switches on `event.type` and dispatches directly to the matching
Redux slice action (e.g., `checksActions.setForPullRequest`). No follow-up IPC
fetches are needed — the data arrives in the event payload.

**`onSyncComplete`** — fired after a full sync of all PRs. This is a simple
signal with no data payload. Used only for UI indicators (e.g., "last synced at"
timestamp).

### Sync operations

**`src/sync/pull-requests.ts`** — Queries GitHub GraphQL for three categories
(`author:@me`, `assignee:@me`, `review-requested:@me`), deduplicates by ID, and
upserts into SQLite. Returns the set of synced IDs so stale PRs can be detected.

**`src/sync/sync-pull-request-details.ts`** — For each PR, sequentially syncs
checks, commits, files, reviews, and comments via REST API with 200ms delays
between calls. Updates `detailsSyncedAt` on success.

**Sync decision logic** (`src/main.ts`): A PR needs a detail sync if it has
never been synced, was updated on GitHub since the last sync, or exceeds a
staleness threshold (1 minute for recently-active PRs, 1 hour for older ones).

### Sending resource events

`src/main/send-resource-events.ts` provides a shared helper that reads fresh
data from SQLite and sends individual `ResourceUpdated` events per resource
type:

```typescript
async function sendPullRequestResourceEvents(
  window: BrowserWindow,
  pullRequestId: string,
  userLogin?: string
): Promise<void>
```

This is used by `main.ts` (after detail sync), `background-syncer.ts` (after
check sync), and API route handlers (after mutations).

---

## 2. Writes: UI → API Server → GitHub → Sync back

### Mutation flow

```
User action (e.g. post comment)
├─ Renderer
│  ├─ dispatch(optimisticAction)         # Instant UI update (temp- ID)
│  └─ fetch(`localhost:${port}/api/...`) # HTTP to API server
│
├─ Main process (Hono route handler)
│  ├─ octokit.rest.*.create(...)         # GitHub REST API
│  ├─ database.insert(...).run()         # Save to SQLite
│  ├─ sendPullRequestResourceEvents()   # Data-carrying events to renderer
│  └─ return response
│
└─ Renderer (response handling)
   ├─ On success:
   │  └─ ResourceUpdated events arrive with real data, replacing temp- entries
   └─ On error:
      ├─ dispatch(rollbackAction)        # Revert optimistic update
      └─ toast.error(message)
```

### API server

`src/main/api/server.ts` runs a Hono HTTP server on a random port. Auth
middleware injects the GitHub token from secure storage into each request
context.

Routes:

| Route                              | Method | Purpose                                         |
| ---------------------------------- | ------ | ----------------------------------------------- |
| `/api/reviews`                     | POST   | Create a pending review                         |
| `/api/reviews/{id}`                | DELETE | Delete a pending review                         |
| `/api/reviews/{id}/submit`         | POST   | Submit review (approve/request changes/comment) |
| `/api/comments`                    | POST   | Create issue comment or review comment reply    |
| `/api/checks/{id}`                 | GET    | Fetch check runs for a PR                       |
| `/api/pull-requests/{id}/activate` | POST   | Mark PR as active for background polling        |
| `/api/pull-requests/{id}/details`  | GET    | Read full PR details from SQLite                |
| `/api/pull-requests/{id}/sync`     | POST   | Trigger sync for a single PR                    |
| `/api/syncs`                       | POST   | Trigger a manual sync                           |

### Frontend API client

`src/app/lib/api.ts` discovers the port via IPC (`window.electron.getApiPort()`)
and caches it. All mutations and data reads go through this client as standard
`fetch` calls.

### Optimistic update pattern

All mutations follow the pattern from CLAUDE.md:

1. **Optimistic update**: Dispatch a Redux action with a temporary entity
   (prefixed `temp-`).
2. **API request**: HTTP call to the local API server.
3. **On success**: The `ResourceUpdated` IPC events arrive with real data from
   SQLite, replacing optimistic entries in the flat slices.
4. **On error**: Rollback the Redux change and show an error toast.

### Example: posting a comment

```
1. createOptimisticComment({ body, pullRequestId, userLogin, ... })
   → dispatch(commentsActions.addComment)  # temp-UUID appears in UI instantly

2. fetch('/api/comments', { method: 'POST', body: { ... } })
   → Hono handler → octokit.rest.issues.createComment()
   → database.insert(comments)
   → sendPullRequestResourceEvents(window, pullRequestId, userLogin)

3a. Success:
   → ResourceUpdated events arrive with data payloads
   → commentsActions.setForPullRequest replaces temp- comments with real ones

3b. Error:
   → dispatch(commentsActions.removeComment({ commentId: tempId }))
   → toast.error('Failed to post comment')
```

### Example: submitting a review

```
1. dispatch(pendingReviewsActions.setReview({ pullRequestId, review: optimistic }))

2. POST /api/reviews/{id}/submit { event: 'APPROVE', body, comments }
   → If comments: delete old review, create new with inline comments
   → If no comments: submit existing review
   → Triggers detail sync in background
   → sendPullRequestResourceEvents(window, pullRequestId, userLogin)

3a. Success:
   → ResourceUpdated events arrive with data payloads
   → Review appears as APPROVED, pending review cleared

3b. Error:
   → dispatch(pendingReviewsActions.clearReview({ pullRequestId }))
   → toast.error(message)
```

---

## 3. Storage layers

| Layer                             | What it stores                                                | Lifetime                 |
| --------------------------------- | ------------------------------------------------------------- | ------------------------ |
| SQLite (`src/database/schema.ts`) | All PR data, reviews, comments, checks, commits, files        | Persistent (disk)        |
| Redux store                       | Active session state derived from SQLite + optimistic updates | App session              |
| localStorage                      | Draft comments, pending review comment edits                  | Persistent (browser)     |
| Electron safeStorage              | GitHub OAuth token (encrypted)                                | Persistent (OS keychain) |

### Database tables

| Table              | Key            | Notes                                                   |
| ------------------ | -------------- | ------------------------------------------------------- |
| `pullRequests`     | GitHub node ID | Base PR info + sync timestamps                          |
| `reviews`          | Local UUID     | States: PENDING, APPROVED, CHANGES_REQUESTED, COMMENTED |
| `comments`         | Local UUID     | Issue comments and review comments                      |
| `commentReactions` | Local UUID     | Emoji reactions                                         |
| `checks`           | Local UUID     | Check runs and status checks                            |
| `commits`          | Local UUID     | Commit history                                          |
| `modifiedFiles`    | Local UUID     | Changed files with diff hunks                           |
| `etags`            | Local UUID     | REST API cache validation                               |

All tables use soft deletes (`deletedAt` column) and track `syncedAt`
timestamps.

### Redux slices

| Slice                   | Shape                                    | Source                             |
| ----------------------- | ---------------------------------------- | ---------------------------------- |
| `checks`                | `{ items: Check[] }`                     | Bootstrap + ResourceUpdated events |
| `comments`              | `{ items: Comment[] }`                   | Bootstrap + ResourceUpdated events |
| `commits`               | `{ items: Commit[] }`                    | Bootstrap + ResourceUpdated events |
| `modifiedFiles`         | `{ items: ModifiedFile[] }`              | Bootstrap + ResourceUpdated events |
| `reactions`             | `{ items: CommentReaction[] }`           | Bootstrap + ResourceUpdated events |
| `reviews`               | `{ items: Review[] }`                    | Bootstrap + ResourceUpdated events |
| `pullRequests`          | `{ items: PullRequest[] }`               | Bootstrap + ResourceUpdated events |
| `pendingReviews`        | `Record<string, PendingReview>`          | Bootstrap + ResourceUpdated events |
| `drafts`                | `Record<string, string>`                 | localStorage                       |
| `pendingReviewComments` | `Record<string, PendingReviewComment[]>` | localStorage                       |
| `navigation`            | Route state                              | Local                              |
| `tasks`                 | Background task tracking                 | IPC TaskUpdate events              |

Each flat resource slice stores items across all PRs in a single `items` array.
Items are tagged with `pullRequestId` and filtered at the component level using
`useAppSelector`. The `setForPullRequest` reducer replaces all items for a given
PR while preserving items from other PRs (and any optimistic entries with
`temp-` prefixed IDs in the comments slice).

---

## Key files

| File                                    | Role                                                             |
| --------------------------------------- | ---------------------------------------------------------------- |
| `src/main.ts`                           | App entry, IPC handlers, startup sync orchestration              |
| `src/preload.ts`                        | IPC bridge exposing `window.electron` and `window.auth`          |
| `src/renderer.tsx`                      | Redux store creation with bootstrap data                         |
| `src/app/App.tsx`                       | IPC event listeners that dispatch to flat Redux slices           |
| `src/app/lib/api.ts`                    | Frontend HTTP client for mutations and data reads                |
| `src/main/api/server.ts`                | Hono HTTP server in main process                                 |
| `src/main/api/routes/*.ts`              | Route handlers (reviews, comments, checks, pull-requests, syncs) |
| `src/main/bootstrap.ts`                 | Reads SQLite, builds flat BootstrapData                          |
| `src/main/background-syncer.ts`         | Background check polling                                         |
| `src/main/send-resource-events.ts`      | Shared helper to send data-carrying ResourceUpdated events       |
| `src/types/ipc-events.ts`               | ResourceUpdatedEvent discriminated union type                    |
| `src/sync/pull-requests.ts`             | GraphQL PR list sync                                             |
| `src/sync/sync-pull-request-details.ts` | Per-PR REST detail sync                                          |
| `src/app/store/*-slice.ts`              | Redux slices (one per resource type)                             |
| `src/lib/ipc/channels.ts`               | IPC channel constants                                            |
| `src/database/schema.ts`                | SQLite schema (Drizzle)                                          |
