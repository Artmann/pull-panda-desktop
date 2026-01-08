import { eq } from 'drizzle-orm'

import { getDatabase } from '../database'
import { pullRequests } from '../database/schema'
import { sleep } from './rateLimitManager'
import { syncChecks } from './syncChecks'
import { syncComments } from './syncComments'
import { syncCommits } from './syncCommits'
import { syncFiles } from './syncFiles'
import { syncReviews } from './syncReviews'

// Delay between sync operations to avoid burst requests
const delayBetweenSyncs = 200

interface SyncPullRequestDetailsParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export interface SyncPullRequestDetailsResult {
  success: boolean
  errors: string[]
}

/**
 * Sync all details (reviews, comments, checks, commits, files) for a single
 * pull request.
 */
export async function syncPullRequestDetails({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncPullRequestDetailsParams): Promise<SyncPullRequestDetailsResult> {
  const errors: string[] = []

  console.log(
    `Starting detail sync for PR #${pullNumber} in ${owner}/${repositoryName}`
  )

  // REST API: syncChecks
  try {
    await syncChecks({
      token,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Checks sync failed: ${message}`)
  }

  await sleep(delayBetweenSyncs)

  // REST API: syncCommits
  try {
    await syncCommits({
      token,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Commits sync failed: ${message}`)
  }

  await sleep(delayBetweenSyncs)

  // REST API: syncFiles
  try {
    await syncFiles({
      token,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Files sync failed: ${message}`)
  }

  await sleep(delayBetweenSyncs)

  // REST API: syncReviews
  try {
    await syncReviews({
      token,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Reviews sync failed: ${message}`)
  }

  await sleep(delayBetweenSyncs)

  // REST API: syncComments
  try {
    await syncComments({
      token,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Comments sync failed: ${message}`)
  }

  console.log(
    `Completed detail sync for PR #${pullNumber} with ${errors.length} errors`
  )

  // Update detailsSyncedAt if sync was successful
  if (errors.length === 0) {
    const database = getDatabase()

    database
      .update(pullRequests)
      .set({ detailsSyncedAt: new Date().toISOString() })
      .where(eq(pullRequests.id, pullRequestId))
      .run()
  }

  return {
    success: errors.length === 0,
    errors
  }
}
