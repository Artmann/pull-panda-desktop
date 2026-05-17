# Main-Process API

The main process exposes a local HTTP API (Hono, bound to
`127.0.0.1:<random port>`) that the renderer calls via `fetch`. Every endpoint
runs through the Effect-TS runtime configured in `src/sync/runtime.ts` and
shares a single error contract.

This document explains how to add a new endpoint and what's expected of it. For
the broader read/write data flow, see
[`architecture.md`](../../../architecture.md).

---

## Directory layout

```
src/main/api/
├── server.ts            # Hono app, CORS, auth middleware, route wiring
├── effect-handler.ts    # Effect-aware Hono handler + validation helpers
├── errors.ts            # Tagged errors + errorToHttp mapping
├── routes/              # Thin Hono adapters (one file per resource)
└── operations/          # Pure Effect operations — the actual logic
```

The split is deliberate:

- **Routes** know about HTTP: paths, params, JSON parsing, status codes.
- **Operations** know about the domain: services, the database, GitHub.

An operation should be runnable from a test or an IPC handler without
constructing a Hono context.

---

## The error contract

Every error response has the same shape:

```json
{ "error": { "message": "human-readable description" } }
```

The shape is produced by `errorToHttp` in `errors.ts` (for tagged errors that
bubble out of an Effect) and by `app.onError` in `server.ts` (for thrown
exceptions). Renderers parse the shape via the helper in `src/app/lib/api.ts`.

**Status codes are derived from the error tag** — operations never call
`context.json(..., 500)` directly. To return a different status, fail the Effect
with the appropriate tagged error and `errorToHttp` will map it.

Current mappings (see `errorToHttp` for the full table):

| Tag                           | Status                           |
| ----------------------------- | -------------------------------- |
| `ValidationError`             | 400                              |
| `UnauthenticatedError`        | 401                              |
| `MissingTokenError`           | 401                              |
| `ForbiddenError`              | 403                              |
| `PermissionError`             | 403                              |
| `NotFoundError`               | 404                              |
| `PrimaryRateLimitError`       | 429                              |
| `SecondaryRateLimitError`     | 429                              |
| `OctokitError` / `HttpError`  | passthrough (502 fallback)       |
| `NetworkError`                | 502                              |
| `GraphQLError`                | 502                              |
| `SchemaDecodeError`           | 502                              |
| `DatabaseNotInitializedError` | 503                              |
| `DatabaseQueryError`          | 500                              |
| `GitOperationError`           | 500                              |
| `FileSystemError`             | 500                              |
| `DeviceFlowError`             | 400 (or 403 for `access_denied`) |

If you need a new error kind, add it to `errors.ts` as a `Data.TaggedError`,
list it in `RouteError`, and add a `case` to `errorToHttp`. TypeScript will fail
the build if the switch is non-exhaustive.

---

## Adding a new endpoint

### 1. Write the operation

Create `src/main/api/operations/<name>.ts`. The operation is an `Effect.gen`
that yields services (`Database`, `Repository`, etc.) and returns the response
payload. Use existing services rather than touching `drizzle` / `octokit`
directly — that's what `Repository` exists for.

```ts
// src/main/api/operations/list-collaborators.ts
import { Effect } from 'effect'
import { Octokit } from '@octokit/rest'

import { MemoryCache } from '../../memory-cache'
import { OctokitError } from '../errors'

const cache = new MemoryCache<ReadonlyArray<Collaborator>>()

export interface ListCollaboratorsInput {
  readonly owner: string
  readonly repo: string
  readonly token: string
}

export interface Collaborator {
  readonly login: string
  readonly avatarUrl: string
}

const octokitErrorOf =
  (operation: string) =>
  (cause: unknown): OctokitError => {
    const status =
      typeof cause === 'object' &&
      cause !== null &&
      'status' in cause &&
      typeof (cause as { status: unknown }).status === 'number'
        ? (cause as { status: number }).status
        : 500
    const message =
      cause instanceof Error ? cause.message : `Failed: ${operation}`

    return new OctokitError({ message, operation, status })
  }

export const listCollaborators = (input: ListCollaboratorsInput) =>
  Effect.gen(function* () {
    const cacheKey = `${input.owner}/${input.repo}`
    const cached = cache.get(cacheKey)

    if (cached) {
      return cached
    }

    const octokit = new Octokit({ auth: input.token })

    const collaborators = yield* Effect.tryPromise({
      try: async () => {
        const response = await octokit.rest.repos.listCollaborators({
          owner: input.owner,
          repo: input.repo
        })

        return response.data.map((entry) => ({
          login: entry.login,
          avatarUrl: entry.avatar_url
        }))
      },
      catch: octokitErrorOf('repos.listCollaborators')
    })

    cache.set(cacheKey, collaborators)

    return collaborators
  })
```

### 2. Wire up the route

Routes should be thin: parse input, call the operation, return. No business
logic.

```ts
// src/main/api/routes/repos.ts
import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  parseJson,
  requireString,
  type AppEnv
} from '../effect-handler'
import { listCollaborators } from '../operations/list-collaborators'

export const reposRoute = new Hono<AppEnv>()

reposRoute.post(
  '/collaborators',
  effectHandler((context) =>
    Effect.gen(function* () {
      const raw = yield* parseJson(context, (input) => {
        const record = (input ?? {}) as Record<string, unknown>

        return { owner: record.owner, repo: record.repo }
      })

      const owner = yield* requireString(raw.owner, 'owner')
      const repo = yield* requireString(raw.repo, 'repo')
      const token = context.get('token')

      return yield* listCollaborators({ owner, repo, token })
    })
  )
)
```

### 3. Register the route

Add one line to `server.ts`:

```ts
app.route('/api/repos', reposRoute)
```

### 4. Call it from the renderer

Add a function to `src/app/lib/api.ts`. The renderer uses a shared helper to
turn the standard error body into a thrown `Error`:

```ts
export async function listCollaborators(
  owner: string,
  repo: string
): Promise<Collaborator[]> {
  const baseUrl = await getApiBaseUrl()

  const response = await fetch(`${baseUrl}/api/repos/collaborators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo })
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to load collaborators')
    )
  }

  return response.json()
}
```

---

## Validation

`effect-handler.ts` exposes three helpers — use them rather than rolling your
own checks. Each one fails with a `ValidationError` (→ 400) that carries the
offending field name, so the renderer gets a useful message.

```ts
import { parseJson, requireNumber, requireString } from '../effect-handler'

const raw =
  yield *
  parseJson(context, (input) => {
    const record = (input ?? {}) as Record<string, unknown>

    return {
      body: record.body,
      pullNumber: record.pullNumber
    }
  })

const body = yield * requireString(raw.body, 'body')
const pullNumber = yield * requireNumber(raw.pullNumber, 'pullNumber')
```

For URL params (`context.req.param(...)`) you generally have a string in hand
already — validate with a plain `if` and `Effect.fail(new ValidationError(...))`
if needed:

```ts
const reviewId = Number(context.req.param('reviewId'))

if (Number.isNaN(reviewId) || reviewId <= 0) {
  return (
    yield *
    Effect.fail(
      new ValidationError({
        field: 'reviewId',
        message: 'must be a positive integer'
      })
    )
  )
}
```

---

## Looking up records

Use the `Repository` service for the common "fetch by id" / "fetch by
coordinates" lookups. The `requireX` variants fail with `NotFoundError` (→ 404)
so you don't need to write the check yourself:

```ts
const repository = yield * Repository

// Returns PullRequest | null
const maybe = yield * repository.findPullRequestById(id)

// Returns PullRequest, fails with NotFoundError if missing
const pullRequest = yield * repository.requirePullRequestById(id)
```

If you need a query the service doesn't expose, add a method to
`src/main/services/repository.ts` rather than reaching into `drizzle` directly
from the operation.

For ad-hoc queries inside an operation, go through `Database.use(label, fn)` —
the label is what shows up in `DatabaseQueryError` so make it specific:

```ts
const database = yield * Database

yield *
  database.use('createComment.insertReply', (db) => {
    db.insert(comments).values(newComment).run()
  })
```

---

## GitHub calls

GitHub REST calls wrap an Octokit promise in `Effect.tryPromise` and convert
failures with the `octokitErrorOf` pattern. Copy it as-is — it preserves the
upstream status code (so 422 stays 422, 404 stays 404) and falls back to 500
when the cause doesn't look like an Octokit error.

GraphQL calls go through the `GitHubGraphQL` service in
`src/sync/services/github-graphql.ts`, which already returns tagged errors.

---

## Side effects after a mutation

After a successful write, broadcast a `ResourceUpdated` event so the renderer's
caches refresh. **Always go through the helpers in
`src/main/send-resource-events.ts`** — they skip destroyed windows and swallow
send errors, so a closing window can't fail an API call or crash a daemon fiber.

```ts
import {
  broadcastPullRequestResourceEvents,
  broadcastResourceUpdated
} from '../../send-resource-events'

// Re-send the full set of PR resource events to every renderer.
yield * Effect.promise(() => broadcastPullRequestResourceEvents(pullRequestId))

// Send a single ResourceUpdated event.
yield *
  Effect.sync(() =>
    broadcastResourceUpdated({
      data: pullRequest,
      pullRequestId,
      type: 'pull-request'
    })
  )
```

For background work that shouldn't block the response (e.g. a follow-up sync),
wrap it in `Effect.forkDaemon`:

```ts
yield* Effect.forkDaemon(
  syncPullRequestDetails({ ... }).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() =>
        console.error('Background sync failed:', error)
      )
    )
  )
)
```

Daemon fibers must catch their own errors — anything that escapes shows up as an
unhandled defect in the logs and won't reach `errorToHttp`.

---

## Logging

- **Don't log on the happy path.** Routes that succeed are silent.
- **Don't double-log errors.** `effectHandler` does not log; `app.onError` in
  `server.ts` logs uncaught exceptions. If you `catchAll` an error to swallow it
  (e.g. inside a daemon fiber), log it there with `console.error` so it isn't
  silently lost.
- **`console.warn` for recoverable issues** — e.g. failing to notify a single
  renderer window.
- **`console.error` for unexpected failures** that you handled but want
  visibility on.
- Include enough context to identify the resource: PR id, operation name,
  upstream status. Avoid logging tokens, request bodies, or anything from user
  content.

---

## Authentication

`server.ts` installs a middleware that reads the GitHub token from main- process
state and puts it in the Hono context (`context.set('token', ...)`). Routes pull
it out via `context.get('token')` and pass it to the operation as input.
Operations don't read auth state themselves — they take the token as a
parameter, which makes them trivially testable.

If a route doesn't need a token, it still goes through the middleware (the
middleware short-circuits with 401 when there is no token). Public endpoints
aren't currently supported; add a bypass in the middleware if you need one.

---

## Testing operations

Operations are plain Effects, so you can run them against a test layer without
HTTP at all:

```ts
import { Effect, Layer } from 'effect'

import { listChecks } from './list-checks'
import { TestDatabase } from '../../../sync/services/database.test-helpers'

it('returns checks for an existing PR', async () => {
  const result = await Effect.runPromise(
    listChecks('pr-123').pipe(Effect.provide(TestDatabase))
  )

  expect(result.checks).toHaveLength(2)
})
```

Routes themselves are thin enough that integration tests against the live Hono
app are usually overkill — test the operation, and trust the handler.

---

## Quick checklist before opening a PR

- [ ] Operation lives in `operations/`, route is a thin adapter in `routes/`.
- [ ] Inputs validated with `parseJson` / `requireString` / `requireNumber`.
- [ ] Errors are tagged (no `throw new Error(...)` inside an operation).
- [ ] DB access goes through `Repository` or `Database.use(label, ...)`.
- [ ] Octokit calls wrapped with `octokitErrorOf` and `Effect.tryPromise`.
- [ ] Post-mutation broadcasts use the helpers in
      `src/main/send-resource-events.ts`.
- [ ] Daemon fibers `catchAll` their errors.
- [ ] Renderer call site uses `extractErrorMessage(error.error, fallback)`.
- [ ] `yarn lint`, `yarn tsc --noEmit`, and `yarn fallow` are clean.
