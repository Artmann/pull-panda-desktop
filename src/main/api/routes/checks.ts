import { Hono } from 'hono'
import { and, eq, isNull } from 'drizzle-orm'

import { getDatabase } from '../../../database'
import { checks, pullRequests } from '../../../database/schema'
import type { Check } from '../../../types/pull-request-details'

export type AppEnv = {
  Variables: {
    token: string
  }
}

function isRunning(check: { state: string | null }): boolean {
  const state = check.state?.toLowerCase()

  return state === 'in_progress' || state === 'queued'
}

export const checksRoute = new Hono<AppEnv>()

// Read-only endpoint - just returns checks from database
// Background syncer handles the actual syncing
checksRoute.get('/:pullRequestId', async (context) => {
  const pullRequestId = context.req.param('pullRequestId')
  const database = getDatabase()

  // Verify the pull request exists
  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  // Read checks from database
  const checkRows = database
    .select()
    .from(checks)
    .where(
      and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
    )
    .all()

  const parsedChecks: Check[] = checkRows.map((row) => ({
    id: row.id,
    gitHubId: row.gitHubId,
    pullRequestId: row.pullRequestId,
    name: row.name,
    state: row.state,
    conclusion: row.conclusion,
    commitSha: row.commitSha,
    suiteName: row.suiteName,
    durationInSeconds: row.durationInSeconds,
    detailsUrl: row.detailsUrl,
    message: row.message,
    url: row.url,
    gitHubCreatedAt: row.gitHubCreatedAt,
    gitHubUpdatedAt: row.gitHubUpdatedAt,
    syncedAt: row.syncedAt
  }))

  const hasRunningChecks = parsedChecks.some(isRunning)

  return context.json({
    checks: parsedChecks,
    hasRunningChecks
  })
})
