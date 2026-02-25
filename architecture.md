# Architecture: Data Flows

This document traces how data moves through the app — from GitHub into the UI,
and back to GitHub on mutations.

## Overview

The app uses a three-layer architecture:

1. **Main process** (Node.js) — database, syncing, GitHub API calls.
2. **Preload bridge** — secure IPC gateway via Electron's `contextBridge`.
3. **Renderer process** (React + Redux) — UI and local state management.

Two communication channels connect the renderer to the main process:

- **IPC** (`ipcRenderer.invoke` / `ipcRenderer.on`) — for data reads and sync
  triggers. Channels defined in `src/lib/ipc/channels.ts`, bridged via
  `src/preload.ts`.
- **HTTP** (`fetch` to `localhost:{port}`) — for mutations (reviews, comments).
  Served by a Hono HTTP server running in the main process
  (`src/main/api/server.ts`).

---

## 1. Reads: GitHub → Syncer → Database → Redux → UI

### Startup sequence

Defined in `src/main.ts` (lines 331–399):

```
app.on('ready')
├─ initializeDatabase()
├─ startApiServer(loadToken)          # Hono on random port
├─ getUserLogin()
├─ bootstrap(userLogin)               # SQLite → BootstrapData
├─ createWindow()
├─ backgroundSyncer.start(loadToken)
└─ syncPullRequests(token)            # GraphQL search
   ├─ syncStalePullRequests()         # Prune closed/merged PRs
   ├─ syncAllPullRequestDetails()     # REST per-PR (if stale)
   ├─ bootstrap(userLogin)            # Refresh BootstrapData
   └─ mainWindow.send(SyncComplete)   # Notify renderer
```

### Bootstrap

`src/main/bootstrap.ts` reads all tables from SQLite and builds a
`BootstrapData` object:

```typescript
interface BootstrapData {
  pullRequests: PullRequest[]
  pullRequestDetails: Record<string, PullRequestDetails>
  pendingReviews: Record<string, PendingReview>
}
```

Each `PullRequest` includes computed counts (approvals, changes requested,
comments) and relation flags (`isAuthor`, `isAssignee`, `isReviewer`). Each
`PullRequestDetails` bundles reviews, comments, reactions, checks, commits, and
files.

### Renderer bootstrap

`src/renderer.tsx` (lines 37–62):

1. Calls `window.electron.getBootstrapData()` via IPC.
2. Filters PRs to only "ready" ones (those with `detailsSyncedAt` set).
3. Creates the Redux store with preloaded state from the bootstrap data.

### Background syncer

`src/main/background-syncer.ts` polls check statuses for "active" PRs (those
the user is currently viewing):

- **With running checks:** every 2 seconds.
- **Without running checks:** every 10 seconds.

After each sync it sends a `ResourceUpdated` IPC event so the renderer can fetch
fresh data.

A PR becomes active when the renderer calls `POST /api/pull-requests/{id}/activate`,
which calls `backgroundSyncer.markPullRequestActive()` and triggers an immediate
sync.

### IPC event listeners

`src/app/App.tsx` (lines 72–136) registers two listeners:

**`onResourceUpdated`** — fired when a single PR's details change (after a
mutation or background check sync):

1. Fetches updated `PullRequestDetails` from main via IPC.
2. Dispatches `setDetails` to update the details slice (preserving any
   optimistic comments with `temp-` prefixed IDs).
3. Updates or clears the pending review in Redux.
4. Fetches and upserts the updated `PullRequest` item.

**`onSyncComplete`** — fired after a full sync of all PRs:

1. Fetches fresh `BootstrapData` from main via IPC.
2. Replaces the entire PR list in Redux.
3. Replaces all pending reviews.

### Sync operations

**`src/sync/pull-requests.ts`** — Queries GitHub GraphQL for three categories
(`author:@me`, `assignee:@me`, `review-requested:@me`), deduplicates by ID, and
upserts into SQLite. Returns the set of synced IDs so stale PRs can be detected.

**`src/sync/sync-pull-request-details.ts`** — For each PR, sequentially syncs
checks, commits, files, reviews, and comments via REST API with 200ms delays
between calls. Updates `detailsSyncedAt` on success.

**Sync decision logic** (`src/main.ts`, lines 213–241): A PR needs a detail sync
if it has never been synced, was updated on GitHub since the last sync, or
exceeds a staleness threshold (1 minute for recently-active PRs, 1 hour for
older ones).

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
│  ├─ mainWindow.send(ResourceUpdated)   # Notify renderer
│  └─ return response
│
└─ Renderer (response handling)
   ├─ On success:
   │  └─ ResourceUpdated listener fetches real data, replaces temp- entries
   └─ On error:
      ├─ dispatch(rollbackAction)        # Revert optimistic update
      └─ toast.error(message)
```

### API server

`src/main/api/server.ts` runs a Hono HTTP server on a random port. Auth
middleware injects the GitHub token from secure storage into each request
context.

Routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/reviews` | POST | Create a pending review |
| `/api/reviews/{id}` | DELETE | Delete a pending review |
| `/api/reviews/{id}/submit` | POST | Submit review (approve/request changes/comment) |
| `/api/comments` | POST | Create issue comment or review comment reply |
| `/api/checks/{id}` | GET | Fetch check runs for a PR |
| `/api/pull-requests/{id}/activate` | POST | Mark PR as active for background polling |
| `/api/syncs` | POST | Trigger a manual sync |

### Frontend API client

`src/app/lib/api.ts` discovers the port via IPC (`window.electron.getApiPort()`)
and caches it. All mutations go through this client as standard `fetch` calls.

### Optimistic update pattern

All mutations follow the pattern from CLAUDE.md:

1. **Optimistic update**: Dispatch a Redux action with a temporary entity
   (prefixed `temp-`).
2. **API request**: HTTP call to the local API server.
3. **On success**: The `ResourceUpdated` IPC event triggers the renderer to
   fetch real data from SQLite, replacing optimistic entries.
4. **On error**: Rollback the Redux change and show an error toast.

### Example: posting a comment

```
1. createOptimisticComment({ body, pullRequestId, userLogin, ... })
   → dispatch(addComment)  # temp-UUID appears in UI instantly

2. fetch('/api/comments', { method: 'POST', body: { ... } })
   → Hono handler → octokit.rest.issues.createComment()
   → database.insert(comments)
   → mainWindow.send(ResourceUpdated, { type: 'pull-request-details', pullRequestId })

3a. Success:
   → onResourceUpdated listener fires
   → window.electron.getPullRequestDetails(pullRequestId)
   → dispatch(setDetails)  # Real comment replaces temp- comment

3b. Error:
   → dispatch(removeComment({ pullRequestId, commentId: tempId }))
   → toast.error('Failed to post comment')
```

### Example: submitting a review

```
1. dispatch(pendingReviewsActions.setReview({ pullRequestId, review: optimistic }))

2. POST /api/reviews/{id}/submit { event: 'APPROVE', body, comments }
   → If comments: delete old review, create new with inline comments
   → If no comments: submit existing review
   → Triggers detail sync in background
   → Sends ResourceUpdated IPC event

3a. Success:
   → onResourceUpdated listener fetches fresh data
   → Review appears as APPROVED, pending review cleared

3b. Error:
   → dispatch(pendingReviewsActions.clearReview({ pullRequestId }))
   → toast.error(message)
```

---

## 3. Storage layers

| Layer | What it stores | Lifetime |
|-------|---------------|----------|
| SQLite (`src/database/schema.ts`) | All PR data, reviews, comments, checks, commits, files | Persistent (disk) |
| Redux store | Active session state derived from SQLite + optimistic updates | App session |
| localStorage | Draft comments, pending review comment edits | Persistent (browser) |
| Electron safeStorage | GitHub OAuth token (encrypted) | Persistent (OS keychain) |

### Database tables

| Table | Key | Notes |
|-------|-----|-------|
| `pullRequests` | GitHub node ID | Base PR info + sync timestamps |
| `reviews` | Local UUID | States: PENDING, APPROVED, CHANGES_REQUESTED, COMMENTED |
| `comments` | Local UUID | Issue comments and review comments |
| `commentReactions` | Local UUID | Emoji reactions |
| `checks` | Local UUID | Check runs and status checks |
| `commits` | Local UUID | Commit history |
| `modifiedFiles` | Local UUID | Changed files with diff hunks |
| `etags` | Local UUID | REST API cache validation |

All tables use soft deletes (`deletedAt` column) and track `syncedAt` timestamps.

### Redux slices

| Slice | Shape | Source |
|-------|-------|--------|
| `pullRequests` | `{ items: PullRequest[] }` | Bootstrap + SyncComplete |
| `pullRequestDetails` | `Record<string, PullRequestDetails>` | Bootstrap + ResourceUpdated |
| `pendingReviews` | `Record<string, PendingReview>` | Bootstrap + ResourceUpdated |
| `drafts` | `Record<string, string>` | localStorage |
| `pendingReviewComments` | `Record<string, PendingReviewComment[]>` | localStorage |
| `navigation` | Route state | Local |
| `tasks` | Background task tracking | IPC TaskUpdate events |

---

## Key files

| File | Role |
|------|------|
| `src/main.ts` | App entry, IPC handlers, startup sync orchestration |
| `src/preload.ts` | IPC bridge exposing `window.electron` and `window.auth` |
| `src/renderer.tsx` | Redux store creation with bootstrap data |
| `src/app/App.tsx` | IPC event listeners that update Redux |
| `src/app/lib/api.ts` | Frontend HTTP client for mutations |
| `src/main/api/server.ts` | Hono HTTP server in main process |
| `src/main/api/routes/*.ts` | Mutation handlers (reviews, comments, checks, pull-requests, syncs) |
| `src/main/bootstrap.ts` | Reads SQLite, builds BootstrapData |
| `src/main/background-syncer.ts` | Background check polling |
| `src/sync/pull-requests.ts` | GraphQL PR list sync |
| `src/sync/sync-pull-request-details.ts` | Per-PR REST detail sync |
| `src/app/store/*-slice.ts` | Redux slices |
| `src/lib/ipc/channels.ts` | IPC channel constants |
| `src/database/schema.ts` | SQLite schema (Drizzle) |
