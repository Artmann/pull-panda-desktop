import { createGraphqlClient } from './graphql'
import { syncChecks } from './syncChecks'
import { syncComments } from './syncComments'
import { syncCommits } from './syncCommits'
import { syncFiles } from './syncFiles'
import { syncReviews } from './syncReviews'

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
  const client = createGraphqlClient(token)
  const errors: string[] = []

  console.log(
    `Starting detail sync for PR #${pullNumber} in ${owner}/${repositoryName}`
  )

  try {
    await syncChecks({
      client,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Checks sync failed: ${message}`)
  }

  try {
    await syncCommits({
      client,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Commits sync failed: ${message}`)
  }

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

  try {
    await syncReviews({
      client,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Reviews sync failed: ${message}`)
  }

  try {
    await syncComments({
      client,
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

  return {
    success: errors.length === 0,
    errors
  }
}
