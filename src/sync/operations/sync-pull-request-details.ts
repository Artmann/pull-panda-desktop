import { Effect, Fiber } from 'effect'
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

interface NamedOperation {
  name: string
  effect: Effect.Effect<
    void,
    SyncError,
    Database | GitHubRest | GitHubGraphQL | EtagStore
  >
}

const buildOperations = (
  params: SyncPullRequestDetailsParams
): ReadonlyArray<NamedOperation> => [
  { name: 'Checks', effect: syncChecks(params) },
  { name: 'Commits', effect: syncCommits(params) },
  { name: 'Files', effect: syncFiles(params) },
  { name: 'Reviews', effect: syncReviews(params) },
  { name: 'Comments', effect: syncComments(params) },
  { name: 'ReviewThreads', effect: syncReviewThreads(params) }
]

const isNotFoundCause = (cause: unknown): boolean => {
  if (!cause || typeof cause !== 'object') {
    return false
  }

  return (cause as { _tag?: string })._tag === 'NotFoundError'
}

const runDetails = (
  params: SyncPullRequestDetailsParams
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

    for (const operation of buildOperations(params)) {
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

type DetailsFiber = Fiber.RuntimeFiber<SyncPullRequestDetailsResult, never>

const inFlight = new Map<string, DetailsFiber>()

export const syncPullRequestDetails = (
  params: SyncPullRequestDetailsParams
): Effect.Effect<
  SyncPullRequestDetailsResult,
  never,
  Database | GitHubRest | GitHubGraphQL | EtagStore
> =>
  Effect.gen(function* () {
    const existing = inFlight.get(params.pullRequestId)

    if (existing) {
      return yield* Fiber.join(existing)
    }

    const fiber = yield* Effect.forkDaemon(runDetails(params))

    inFlight.set(params.pullRequestId, fiber)

    return yield* Fiber.join(fiber).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          inFlight.delete(params.pullRequestId)
        })
      )
    )
  })
