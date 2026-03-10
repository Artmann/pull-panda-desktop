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
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  backgroundSyncer.markPullRequestActive(pullRequestId)

  // Fire-and-forget detail sync so the user gets fresh data immediately
  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .get()

  if (pullRequest) {
    syncPullRequestDetails({
      token,
      pullRequestId,
      owner: pullRequest.repositoryOwner,
      repositoryName: pullRequest.repositoryName,
      pullNumber: pullRequest.number
    })
      .then(() => {
        for (const window of BrowserWindow.getAllWindows()) {
          sendPullRequestResourceEvents(window, pullRequestId)
        }
      })
      .catch((error) => {
        console.error(
          `Failed to sync details for activated PR ${pullRequestId}:`,
          error
        )
      })
  }

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

  if (request.title !== undefined && request.title.trim() === '') {
    return context.json({ error: 'Title cannot be empty' }, 400)
  }

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

pullRequestsRoute.get('/:pullRequestId/merge-options', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

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
    const [{ data: repo }, { data: pull }] = await Promise.all([
      octokit.rest.repos.get({
        owner: pullRequest.repositoryOwner,
        repo: pullRequest.repositoryName
      }),
      octokit.rest.pulls.get({
        owner: pullRequest.repositoryOwner,
        pull_number: pullRequest.number,
        repo: pullRequest.repositoryName
      })
    ])

    return context.json({
      allowMergeCommit: repo.allow_merge_commit ?? true,
      allowRebaseMerge: repo.allow_rebase_merge ?? true,
      allowSquashMerge: repo.allow_squash_merge ?? true,
      mergeable: pull.mergeable,
      mergeableState: pull.mergeable_state
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to fetch merge options:', error)

    return context.json({ error: message }, 500)
  }
})

interface MergePullRequestBody {
  mergeMethod: 'merge' | 'squash' | 'rebase'
  owner: string
  pullNumber: number
  repo: string
}

pullRequestsRoute.post('/:pullRequestId/merge', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const request = await context.req.json<MergePullRequestBody>()
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
    await octokit.rest.pulls.merge({
      owner: request.owner,
      repo: request.repo,
      pull_number: request.pullNumber,
      merge_method: request.mergeMethod
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to merge pull request:', error)

    return context.json({ error: message }, 500)
  }

  const now = new Date().toISOString()

  database
    .update(pullRequests)
    .set({
      state: 'MERGED',
      mergedAt: now,
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
