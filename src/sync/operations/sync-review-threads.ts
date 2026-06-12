import { Effect } from 'effect'
import { eq } from 'drizzle-orm'

import {
  comments,
  reviewThreads,
  type NewReviewThread
} from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import {
  ReviewThreadsResponseSchema,
  type ReviewThreadNode
} from '../schemas/github-graphql'
import { Database } from '../services/database'
import { GitHubGraphQL } from '../services/github-graphql'
import { reconcileBySoftDelete } from '../shared/reconcile'
import { generateId } from '../shared/utils'

interface SyncReviewThreadsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const reviewThreadsQuery = `
  query ReviewThreads($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            isResolved
            resolvedBy {
              login
            }
            comments(first: 100) {
              nodes {
                id
                databaseId
              }
            }
          }
        }
      }
    }
    rateLimit {
      cost
      limit
      remaining
      resetAt
    }
  }
`

export const syncReviewThreads = (
  params: SyncReviewThreadsParams
): Effect.Effect<void, SyncError, Database | GitHubGraphQL> =>
  Effect.gen(function* () {
    const graphql = yield* GitHubGraphQL
    const database = yield* Database

    const allThreads: ReviewThreadNode[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const response = yield* graphql
        .query(
          reviewThreadsQuery,
          {
            owner: params.owner,
            repo: params.repositoryName,
            number: params.pullNumber,
            cursor
          },
          ReviewThreadsResponseSchema
        )
        .pipe(
          Effect.mapError(
            (cause) =>
              new SyncDetailFailedError({
                operation: 'review_threads',
                pullRequestId: params.pullRequestId,
                cause
              }) as SyncError
          )
        )

      const pullRequest = response.repository?.pullRequest

      if (!pullRequest) {
        return
      }

      for (const node of pullRequest.reviewThreads.nodes) {
        allThreads.push(node)
      }

      hasNextPage = pullRequest.reviewThreads.pageInfo.hasNextPage
      cursor = pullRequest.reviewThreads.pageInfo.endCursor
    }

    const now = new Date().toISOString()

    yield* database.use('syncReviewThreads', (db) => {
      reconcileBySoftDelete(db, reviewThreads, {
        scope: [eq(reviewThreads.pullRequestId, params.pullRequestId)],
        items: allThreads,
        keyOfItem: (threadNode) => threadNode.id,
        keyOfRow: (row) => row.gitHubId,
        build: (threadNode, existingId): NewReviewThread => ({
          id: existingId ?? generateId(),
          gitHubId: threadNode.id,
          pullRequestId: params.pullRequestId,
          isResolved: threadNode.isResolved,
          resolvedByLogin: threadNode.resolvedBy?.login ?? null,
          syncedAt: now,
          deletedAt: null
        }),
        now
      })

      // Link each thread's comments back to the thread by GitHub id.
      for (const threadNode of allThreads) {
        for (const commentNode of threadNode.comments.nodes) {
          db.update(comments)
            .set({ gitHubReviewThreadId: threadNode.id })
            .where(eq(comments.gitHubId, commentNode.id))
            .run()
        }
      }
    })
  })
