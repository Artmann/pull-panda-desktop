import { Effect, Fiber, Ref } from 'effect'
import { eq } from 'drizzle-orm'

import { pullRequests } from '../../database/schema'
import { type SyncError } from '../errors'
import type { SyncPullRequestDetailsResult } from '../schemas/domain'
import { Database } from '../services/database'
import { EtagStore } from '../services/etag-store'
import { GitHubGraphQL } from '../services/github-graphql'
import { GitHubRest } from '../services/github-rest'
import { syncChecks } from './sync-checks'
import { syncComments } from './sync-comments'
import { syncCommits } from './sync-commits'
import { syncFiles } from './sync-files'
import { syncReviewThreads } from './sync-review-threads'
import { syncReviews } from './sync-reviews'

export interface SyncPullRequestDetailsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export interface NamedOperation {
  name: string
  effect: Effect.Effect<
    void,
    SyncError,
    Database | GitHubRest | GitHubGraphQL | EtagStore
  >
}

const spanAttributes = (params: SyncPullRequestDetailsParams) => ({
  'pr.id': params.pullRequestId,
  'pr.number': params.pullNumber,
  repository: `${params.owner}/${params.repositoryName}`
})

const buildOperations = (
  params: SyncPullRequestDetailsParams
): ReadonlyArray<NamedOperation> => {
  const attributes = spanAttributes(params)

  return [
    {
      name: 'Checks',
      effect: syncChecks(params).pipe(
        Effect.withSpan('sync.checks', { attributes })
      )
    },
    {
      name: 'Commits',
      effect: syncCommits(params).pipe(
        Effect.withSpan('sync.commits', { attributes })
      )
    },
    {
      name: 'Files',
      effect: syncFiles(params).pipe(
        Effect.withSpan('sync.files', { attributes })
      )
    },
    {
      name: 'Reviews',
      effect: syncReviews(params).pipe(
        Effect.withSpan('sync.reviews', { attributes })
      )
    },
    {
      name: 'Comments',
      effect: syncComments(params).pipe(
        Effect.withSpan('sync.comments', { attributes })
      )
    },
    {
      name: 'ReviewThreads',
      effect: syncReviewThreads(params).pipe(
        Effect.withSpan('sync.reviewThreads', { attributes })
      )
    }
  ]
}

const isNotFoundCause = (cause: unknown): boolean => {
  if (!cause || typeof cause !== 'object') {
    return false
  }

  return (cause as { _tag?: string })._tag === 'NotFoundError'
}

// Exported for tests so they can inject a fixed list of named operations and
// exercise orchestration (not-found short-circuit, partial-error collection)
// without standing up the full transport stack.
export const runDetailsWithOperations = (
  params: SyncPullRequestDetailsParams,
  operations: ReadonlyArray<NamedOperation>
): Effect.Effect<
  SyncPullRequestDetailsResult,
  never,
  Database | GitHubRest | GitHubGraphQL | EtagStore
> =>
  Effect.gen(function* () {
    const database = yield* Database
    const errors: string[] = []
    let notFound = false

    yield* Effect.logInfo(
      `Starting detail sync for PR #${params.pullNumber} in ${params.owner}/${params.repositoryName}`
    )

    for (const operation of operations) {
      const outcome = yield* Effect.either(operation.effect)

      if (outcome._tag === 'Right') {
        continue
      }

      const error = outcome.left

      if (error._tag === 'NotFoundError') {
        notFound = true
        break
      }

      if (
        error._tag === 'SyncDetailFailedError' &&
        isNotFoundCause(error.cause)
      ) {
        notFound = true
        break
      }

      const message = `${error._tag}: ${JSON.stringify(error)}`
      errors.push(`${operation.name} sync failed: ${message}`)
    }

    if (notFound) {
      yield* Effect.logInfo(
        `PR #${params.pullNumber} in ${params.owner}/${params.repositoryName} returned 404`
      )

      return {
        errors: [] as ReadonlyArray<string>,
        notFound: true,
        success: false
      }
    }

    if (errors.length === 0) {
      yield* database
        .use('syncDetails.markCompleted', (db) => {
          db.update(pullRequests)
            .set({ detailsSyncedAt: new Date().toISOString() })
            .where(eq(pullRequests.id, params.pullRequestId))
            .run()
        })
        .pipe(Effect.catchAll(() => Effect.void))
    }

    return {
      errors,
      notFound: false,
      success: errors.length === 0
    }
  })

const runDetails = (
  params: SyncPullRequestDetailsParams
): Effect.Effect<
  SyncPullRequestDetailsResult,
  never,
  Database | GitHubRest | GitHubGraphQL | EtagStore
> =>
  runDetailsWithOperations(params, buildOperations(params)).pipe(
    Effect.withSpan('sync.pullRequestDetails', {
      attributes: spanAttributes(params)
    })
  )

type DetailsFiber = Fiber.RuntimeFiber<SyncPullRequestDetailsResult, never>

const inFlightRef = Ref.unsafeMake(new Map<string, DetailsFiber>())

// Exposed for tests that need to assert in-flight de-duplication semantics
// across invocations.
export const __testing = {
  inFlightRef
}

// Interrupts every detail-sync fiber currently registered in the in-flight map
// and clears the map. Used by BackgroundSyncer.stop so daemon fibers don't
// outlive runtime disposal and touch the database after it closes.
export const interruptAllInFlightDetails: Effect.Effect<void> = Effect.gen(
  function* () {
    const map = yield* Ref.getAndSet(inFlightRef, new Map())

    yield* Effect.forEach(
      Array.from(map.values()),
      (fiber) => Fiber.interrupt(fiber),
      { discard: true }
    )
  }
)

export const syncPullRequestDetails = (
  params: SyncPullRequestDetailsParams
): Effect.Effect<
  SyncPullRequestDetailsResult,
  never,
  Database | GitHubRest | GitHubGraphQL | EtagStore
> =>
  Effect.gen(function* () {
    const id = params.pullRequestId

    const existing = yield* Ref.modify(inFlightRef, (map) => {
      const fiber = map.get(id)

      return [fiber, map] as const
    })

    if (existing) {
      return yield* Fiber.join(existing)
    }

    const candidate = yield* Effect.forkDaemon(runDetails(params))

    const winner = yield* Ref.modify(inFlightRef, (map) => {
      const found = map.get(id)

      if (found) {
        return [found, map] as const
      }

      const next = new Map(map)
      next.set(id, candidate)

      return [candidate, next] as const
    })

    if (winner !== candidate) {
      yield* Fiber.interrupt(candidate)

      return yield* Fiber.join(winner)
    }

    return yield* Fiber.join(candidate).pipe(
      Effect.ensuring(
        Ref.update(inFlightRef, (map) => {
          if (map.get(id) !== candidate) {
            return map
          }

          const next = new Map(map)
          next.delete(id)

          return next
        })
      )
    )
  })
