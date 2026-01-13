import { Hono } from 'hono'

import { backgroundSyncer } from '../../background-syncer'

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
