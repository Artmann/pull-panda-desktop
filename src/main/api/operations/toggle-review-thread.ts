import { Effect } from 'effect'
import { eq } from 'drizzle-orm'

import { reviewThreads } from '../../../database/schema'
import {
  ResolveThreadResponseSchema,
  UnresolveThreadResponseSchema
} from '../../../sync/schemas/github-graphql'
import { Database } from '../../../sync/services/database'
import { GitHubGraphQL } from '../../../sync/services/github-graphql'
import { Repository } from '../../services/repository'
import { broadcastPullRequestResourceEvents } from '../../send-resource-events'

export interface ToggleReviewThreadInput {
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly threadId: string
}

export interface ToggleReviewThreadResult {
  readonly gitHubId: string
  readonly isResolved: boolean
  readonly resolvedByLogin: string | null
}

const resolveMutation = `
  mutation ResolveReviewThread($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread {
        id
        isResolved
        resolvedBy {
          login
        }
      }
    }
  }
`

const unresolveMutation = `
  mutation UnresolveReviewThread($threadId: ID!) {
    unresolveReviewThread(input: {threadId: $threadId}) {
      thread {
        id
        isResolved
        resolvedBy {
          login
        }
      }
    }
  }
`

const notifyRenderer = (input: ToggleReviewThreadInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const pullRequest = yield* repository.findPullRequestByCoords({
      number: input.pullNumber,
      owner: input.owner,
      repo: input.repo
    })

    if (!pullRequest) {
      return
    }

    yield* Effect.promise(() =>
      broadcastPullRequestResourceEvents(pullRequest.id)
    )
  })

type ResolvedThread =
  (typeof ResolveThreadResponseSchema.Type)['resolveReviewThread']['thread']

// Stores the thread state GitHub returned, tells the renderer, and returns the
// new resolution state.
const storeThreadResolution = (
  operation: string,
  input: ToggleReviewThreadInput,
  thread: ResolvedThread
) =>
  Effect.gen(function* () {
    const database = yield* Database
    const now = new Date().toISOString()

    yield* database.use(operation, (db) => {
      db.update(reviewThreads)
        .set({
          isResolved: thread.isResolved,
          resolvedByLogin: thread.resolvedBy?.login ?? null,
          syncedAt: now
        })
        .where(eq(reviewThreads.gitHubId, thread.id))
        .run()
    })

    yield* notifyRenderer(input)

    const result: ToggleReviewThreadResult = {
      gitHubId: thread.id,
      isResolved: thread.isResolved,
      resolvedByLogin: thread.resolvedBy?.login ?? null
    }

    return result
  })

export const resolveReviewThread = (input: ToggleReviewThreadInput) =>
  Effect.gen(function* () {
    const graphql = yield* GitHubGraphQL

    const response = yield* graphql.query(
      resolveMutation,
      { threadId: input.threadId },
      ResolveThreadResponseSchema
    )

    return yield* storeThreadResolution(
      'resolveReviewThread.update',
      input,
      response.resolveReviewThread.thread
    )
  })

export const unresolveReviewThread = (input: ToggleReviewThreadInput) =>
  Effect.gen(function* () {
    const graphql = yield* GitHubGraphQL

    const response = yield* graphql.query(
      unresolveMutation,
      { threadId: input.threadId },
      UnresolveThreadResponseSchema
    )

    return yield* storeThreadResolution(
      'unresolveReviewThread.update',
      input,
      response.unresolveReviewThread.thread
    )
  })
