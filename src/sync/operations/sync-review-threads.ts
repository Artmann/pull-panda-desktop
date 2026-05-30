import { Effect } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

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
      const existingThreads = db
        .select()
        .from(reviewThreads)
        .where(
          and(
            eq(reviewThreads.pullRequestId, params.pullRequestId),
            isNull(reviewThreads.deletedAt)
          )
        )
        .all()

      const syncedGitHubIds: string[] = []

      for (const threadNode of allThreads) {
        const gitHubId = threadNode.id
        syncedGitHubIds.push(gitHubId)

        const existingThread = existingThreads.find(
          (row) => row.gitHubId === gitHubId
        )

        const threadId = existingThread?.id ?? generateId()

        const thread: NewReviewThread = {
          id: threadId,
          gitHubId,
          pullRequestId: params.pullRequestId,
          isResolved: threadNode.isResolved,
          resolvedByLogin: threadNode.resolvedBy?.login ?? null,
          syncedAt: now,
          deletedAt: null
        }

        db.insert(reviewThreads)
          .values(thread)
          .onConflictDoUpdate({
            target: reviewThreads.id,
            set: {
              isResolved: thread.isResolved,
              resolvedByLogin: thread.resolvedByLogin,
              syncedAt: thread.syncedAt,
              deletedAt: null
            }
          })
          .run()

        for (const commentNode of threadNode.comments.nodes) {
          db.update(comments)
            .set({ gitHubReviewThreadId: gitHubId })
            .where(eq(comments.gitHubId, commentNode.id))
            .run()
        }
      }

      for (const existingThread of existingThreads) {
        if (!syncedGitHubIds.includes(existingThread.gitHubId)) {
          db.update(reviewThreads)
            .set({ deletedAt: now })
            .where(eq(reviewThreads.id, existingThread.id))
            .run()
        }
      }
    })
  })
