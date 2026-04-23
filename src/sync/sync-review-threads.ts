import { and, eq, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import {
  comments,
  reviewThreads,
  type NewReviewThread
} from '../database/schema'

import { createGraphQLClient } from './graphql-client'
import { generateId } from './utils'

interface SyncReviewThreadsParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

interface ThreadCommentNode {
  id: string
  databaseId: number | null
}

interface ThreadNode {
  id: string
  isResolved: boolean
  resolvedBy: {
    login: string
  } | null
  comments: {
    nodes: ThreadCommentNode[]
  }
}

interface ReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        pageInfo: {
          hasNextPage: boolean
          endCursor: string | null
        }
        nodes: ThreadNode[]
      }
    } | null
  } | null
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
      limit
      remaining
      resetAt
    }
  }
`

export async function syncReviewThreads({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncReviewThreadsParams): Promise<void> {
  console.time('syncReviewThreads')

  try {
    const client = createGraphQLClient(token)

    const allThreads: ThreadNode[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const response: ReviewThreadsResponse =
        await client.query<ReviewThreadsResponse>(reviewThreadsQuery, {
          owner,
          repo: repositoryName,
          number: pullNumber,
          cursor
        })

      const pullRequest = response.repository?.pullRequest

      if (!pullRequest) {
        console.timeEnd('syncReviewThreads')

        return
      }

      allThreads.push(...pullRequest.reviewThreads.nodes)

      hasNextPage = pullRequest.reviewThreads.pageInfo.hasNextPage
      cursor = pullRequest.reviewThreads.pageInfo.endCursor
    }

    console.log(
      `Found ${allThreads.length} review threads for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingThreads = database
      .select()
      .from(reviewThreads)
      .where(
        and(
          eq(reviewThreads.pullRequestId, pullRequestId),
          isNull(reviewThreads.deletedAt)
        )
      )
      .all()

    const syncedGitHubIds: string[] = []

    for (const threadNode of allThreads) {
      const gitHubId = threadNode.id
      syncedGitHubIds.push(gitHubId)

      const existingThread = existingThreads.find(
        (thread) => thread.gitHubId === gitHubId
      )

      const threadId = existingThread?.id ?? generateId()

      const thread: NewReviewThread = {
        id: threadId,
        gitHubId,
        pullRequestId,
        isResolved: threadNode.isResolved,
        resolvedByLogin: threadNode.resolvedBy?.login ?? null,
        syncedAt: now,
        deletedAt: null
      }

      database
        .insert(reviewThreads)
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
        database
          .update(comments)
          .set({ gitHubReviewThreadId: gitHubId })
          .where(eq(comments.gitHubId, commentNode.id))
          .run()
      }
    }

    for (const existingThread of existingThreads) {
      if (!syncedGitHubIds.includes(existingThread.gitHubId)) {
        database
          .update(reviewThreads)
          .set({ deletedAt: now })
          .where(eq(reviewThreads.id, existingThread.id))
          .run()
      }
    }

    console.timeEnd('syncReviewThreads')
  } catch (error) {
    console.timeEnd('syncReviewThreads')
    console.error('Error syncing review threads:', error)
    throw error
  }
}
