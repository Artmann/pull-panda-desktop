import { RequestError } from '@octokit/request-error'
import { eq } from 'drizzle-orm'

import { getDatabase, isDatabaseInitialized } from '../database'
import { pullRequests } from '../database/schema'
import { sleep } from './rate-limit-manager'
import { syncChecks } from './sync-checks'
import { syncComments } from './sync-comments'
import { syncCommits } from './sync-commits'
import { syncFiles } from './sync-files'
import { syncReviews } from './sync-reviews'
import { syncReviewThreads } from './sync-review-threads'

// Delay between sync operations to avoid burst requests
const delayBetweenSyncs = 200

function isNotFoundError(error: unknown): boolean {
  return error instanceof RequestError && error.status === 404
}

interface SyncPullRequestDetailsParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export interface SyncPullRequestDetailsResult {
  errors: string[]
  notFound: boolean
  success: boolean
}

const inFlightSyncs = new Map<string, Promise<SyncPullRequestDetailsResult>>()

/**
 * Sync all details (reviews, comments, checks, commits, files) for a single
 * pull request.
 */
export async function syncPullRequestDetails(
  params: SyncPullRequestDetailsParams
): Promise<SyncPullRequestDetailsResult> {
  const existing = inFlightSyncs.get(params.pullRequestId)

  if (existing) {
    return existing
  }

  const promise = runSyncPullRequestDetails(params).finally(() => {
    inFlightSyncs.delete(params.pullRequestId)
  })

  inFlightSyncs.set(params.pullRequestId, promise)

  return promise
}

async function runSyncPullRequestDetails({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncPullRequestDetailsParams): Promise<SyncPullRequestDetailsResult> {
  if (!isDatabaseInitialized()) {
    return {
      errors: ['Database not initialized'],
      notFound: false,
      success: false
    }
  }

  const errors: string[] = []

  console.log(
    `Starting detail sync for PR #${pullNumber} in ${owner}/${repositoryName}`
  )

  const syncParams = { token, pullRequestId, owner, repositoryName, pullNumber }

  const syncOperations = [
    { name: 'Checks', fn: syncChecks },
    { name: 'Commits', fn: syncCommits },
    { name: 'Files', fn: syncFiles },
    { name: 'Reviews', fn: syncReviews },
    { name: 'Comments', fn: syncComments },
    { name: 'ReviewThreads', fn: syncReviewThreads }
  ]

  for (const operation of syncOperations) {
    try {
      await operation.fn(syncParams)
    } catch (error) {
      if (isNotFoundError(error)) {
        console.log(
          `PR #${pullNumber} in ${owner}/${repositoryName} returned 404 — repository is likely inaccessible`
        )

        return { errors: [], notFound: true, success: false }
      }

      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${operation.name} sync failed: ${message}`)
    }

    await sleep(delayBetweenSyncs)
  }

  console.log(
    `Completed detail sync for PR #${pullNumber} with ${errors.length} errors`
  )

  // Update detailsSyncedAt if sync was successful
  if (errors.length === 0 && isDatabaseInitialized()) {
    const database = getDatabase()

    database
      .update(pullRequests)
      .set({ detailsSyncedAt: new Date().toISOString() })
      .where(eq(pullRequests.id, pullRequestId))
      .run()
  }

  return {
    errors,
    notFound: false,
    success: errors.length === 0
  }
}
