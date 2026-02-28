import { BrowserWindow } from 'electron'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'

import { getDatabase } from '../../../database'
import { pullRequests } from '../../../database/schema'
import { backgroundSyncer } from '../../background-syncer'
import { getPullRequestDetails } from '../../bootstrap'
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
