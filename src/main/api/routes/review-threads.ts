import { BrowserWindow } from 'electron'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'

import { getDatabase } from '../../../database'
import { pullRequests, reviewThreads } from '../../../database/schema'
import { createGraphQLClient } from '../../../sync/graphql-client'
import { sendPullRequestResourceEvents } from '../../send-resource-events'

import type { AppEnv } from './comments'

interface ResolveRequest {
  owner: string
  pullNumber: number
  repo: string
  threadId: string
}

interface ResolveMutationResponse {
  resolveReviewThread: {
    thread: {
      id: string
      isResolved: boolean
      resolvedBy: {
        login: string
      } | null
    }
  }
}

interface UnresolveMutationResponse {
  unresolveReviewThread: {
    thread: {
      id: string
      isResolved: boolean
      resolvedBy: {
        login: string
      } | null
    }
  }
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

export const reviewThreadsRoute = new Hono<AppEnv>()

reviewThreadsRoute.post('/resolve', async (context) => {
  const token = context.get('token')
  const request = await context.req.json<ResolveRequest>()

  if (!request.threadId || !request.owner || !request.repo || !request.pullNumber) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  try {
    const client = createGraphQLClient(token)

    const response = await client.query<ResolveMutationResponse>(
      resolveMutation,
      { threadId: request.threadId }
    )

    const thread = response.resolveReviewThread.thread
    const now = new Date().toISOString()

    updateThreadLocally(request, {
      gitHubId: thread.id,
      isResolved: thread.isResolved,
      resolvedByLogin: thread.resolvedBy?.login ?? null,
      syncedAt: now
    })

    await notifyRenderer(request)

    return context.json({
      gitHubId: thread.id,
      isResolved: thread.isResolved,
      resolvedByLogin: thread.resolvedBy?.login ?? null
    })
  } catch (error) {
    console.error('Failed to resolve review thread:', error)

    const message =
      error instanceof Error ? error.message : 'Failed to resolve review thread'

    return context.json({ error: message }, 500)
  }
})

reviewThreadsRoute.post('/unresolve', async (context) => {
  const token = context.get('token')
  const request = await context.req.json<ResolveRequest>()

  if (!request.threadId || !request.owner || !request.repo || !request.pullNumber) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  try {
    const client = createGraphQLClient(token)

    const response = await client.query<UnresolveMutationResponse>(
      unresolveMutation,
      { threadId: request.threadId }
    )

    const thread = response.unresolveReviewThread.thread
    const now = new Date().toISOString()

    updateThreadLocally(request, {
      gitHubId: thread.id,
      isResolved: thread.isResolved,
      resolvedByLogin: thread.resolvedBy?.login ?? null,
      syncedAt: now
    })

    await notifyRenderer(request)

    return context.json({
      gitHubId: thread.id,
      isResolved: thread.isResolved,
      resolvedByLogin: thread.resolvedBy?.login ?? null
    })
  } catch (error) {
    console.error('Failed to unresolve review thread:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Failed to unresolve review thread'

    return context.json({ error: message }, 500)
  }
})

interface ThreadUpdate {
  gitHubId: string
  isResolved: boolean
  resolvedByLogin: string | null
  syncedAt: string
}

function updateThreadLocally(
  request: ResolveRequest,
  update: ThreadUpdate
): void {
  const database = getDatabase()

  database
    .update(reviewThreads)
    .set({
      isResolved: update.isResolved,
      resolvedByLogin: update.resolvedByLogin,
      syncedAt: update.syncedAt
    })
    .where(eq(reviewThreads.gitHubId, update.gitHubId))
    .run()
}

async function notifyRenderer(request: ResolveRequest): Promise<void> {
  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repositoryOwner, request.owner),
        eq(pullRequests.repositoryName, request.repo),
        eq(pullRequests.number, request.pullNumber)
      )
    )
    .get()

  if (!pullRequest) {
    return
  }

  for (const window of BrowserWindow.getAllWindows()) {
    await sendPullRequestResourceEvents(window, pullRequest.id)
  }
}
