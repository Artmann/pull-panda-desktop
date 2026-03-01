import { BrowserWindow } from 'electron'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { Octokit } from '@octokit/rest'

import { getDatabase } from '../../../database'
import { pullRequests } from '../../../database/schema'
import { ipcChannels } from '../../../lib/ipc/channels'
import { backgroundSyncer } from '../../background-syncer'
import { getPullRequest, getPullRequestDetails } from '../../bootstrap'
import { sendPullRequestResourceEvents } from '../../send-resource-events'
import { syncPullRequestDetails } from '../../../sync/sync-pull-request-details'

import type { AppEnv } from './comments'

export const pullRequestsRoute = new Hono<AppEnv>()

pullRequestsRoute.post('/:pullRequestId/activate', (context) => {
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  backgroundSyncer.markPullRequestActive(pullRequestId)

  return context.json({ success: true })
})

pullRequestsRoute.get('/:pullRequestId/details', async (context) => {
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const details = await getPullRequestDetails(pullRequestId)

  if (!details) {
    return context.json({ error: 'Pull request details not found' }, 404)
  }

  return context.json(details)
})

interface UpdatePullRequestBody {
  body?: string
  isDraft?: boolean
  owner: string
  pullNumber: number
  repo: string
  state?: 'open' | 'closed'
  title?: string
}

pullRequestsRoute.patch('/:pullRequestId', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const request = await context.req.json<UpdatePullRequestBody>()

  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const octokit = new Octokit({ auth: token })

  try {
    await octokit.rest.pulls.update({
      owner: request.owner,
      repo: request.repo,
      pull_number: request.pullNumber,
      ...(request.title !== undefined && { title: request.title }),
      ...(request.body !== undefined && { body: request.body }),
      ...(request.state !== undefined && { state: request.state }),
      ...(request.isDraft !== undefined && { draft: request.isDraft })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to update pull request:', error)

    return context.json({ error: message }, 500)
  }

  const now = new Date().toISOString()
  const newState =
    request.state === 'closed'
      ? 'CLOSED'
      : request.state === 'open'
        ? 'OPEN'
        : pullRequest.state

  database
    .update(pullRequests)
    .set({
      ...(request.title !== undefined && { title: request.title }),
      ...(request.body !== undefined && { body: request.body }),
      ...(request.state !== undefined && { state: newState }),
      ...(request.isDraft !== undefined && { isDraft: request.isDraft }),
      updatedAt: now
    })
    .where(eq(pullRequests.id, pullRequestId))
    .run()

  const updated = await getPullRequest(pullRequestId)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(ipcChannels.ResourceUpdated, {
      data: updated,
      pullRequestId,
      type: 'pull-request'
    })
  }

  return context.json(updated)
})

pullRequestsRoute.post('/:pullRequestId/sync', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.id, pullRequestId)))
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const result = await syncPullRequestDetails({
    token,
    pullRequestId,
    owner: pullRequest.repositoryOwner,
    repositoryName: pullRequest.repositoryName,
    pullNumber: pullRequest.number
  })

  // Send resource events to all windows
  for (const window of BrowserWindow.getAllWindows()) {
    await sendPullRequestResourceEvents(window, pullRequestId)
  }

  return context.json(result)
})
