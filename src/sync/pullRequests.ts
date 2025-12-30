import { getDatabase } from '../database'
import { pullRequests, type NewPullRequest } from '../database/schema'
import {
  createGraphqlClient,
  fetchAuthoredPullRequests,
  fetchAssignedPullRequests,
  fetchReviewRequestedPullRequests
} from './graphql'
import type { GitHubPullRequest } from './types'

export interface SyncResult {
  synced: number
  errors: string[]
}

interface RelationFlags {
  isAuthor: boolean
  isAssignee: boolean
  isReviewer: boolean
}

function transformPullRequest(
  pullRequest: GitHubPullRequest,
  relation: RelationFlags
): NewPullRequest {
  const now = new Date().toISOString()

  return {
    id: pullRequest.id,
    number: pullRequest.number,
    title: pullRequest.title,
    state: pullRequest.state,
    url: pullRequest.url,
    repositoryOwner: pullRequest.repository.owner.login,
    repositoryName: pullRequest.repository.name,
    authorLogin: pullRequest.author?.login ?? null,
    authorAvatarUrl: pullRequest.author?.avatarUrl ?? null,
    createdAt: pullRequest.createdAt,
    updatedAt: pullRequest.updatedAt,
    closedAt: pullRequest.closedAt,
    mergedAt: pullRequest.mergedAt,
    isAuthor: relation.isAuthor,
    isAssignee: relation.isAssignee,
    isReviewer: relation.isReviewer,
    labels: JSON.stringify(pullRequest.labels.nodes),
    assignees: JSON.stringify(pullRequest.assignees.nodes),
    syncedAt: now
  }
}

export async function syncPullRequests(token: string): Promise<SyncResult> {
  const client = createGraphqlClient(token)
  const database = getDatabase()
  const errors: string[] = []
  const pullRequestMap = new Map<string, NewPullRequest>()

  try {
    const authored = await fetchAuthoredPullRequests(client)

    for (const pullRequest of authored) {
      const existing = pullRequestMap.get(pullRequest.id)

      pullRequestMap.set(
        pullRequest.id,
        transformPullRequest(pullRequest, {
          isAuthor: true,
          isAssignee: existing?.isAssignee ?? false,
          isReviewer: existing?.isReviewer ?? false
        })
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch authored PRs: ${message}`)
  }

  try {
    const assigned = await fetchAssignedPullRequests(client)

    for (const pullRequest of assigned) {
      const existing = pullRequestMap.get(pullRequest.id)

      pullRequestMap.set(
        pullRequest.id,
        transformPullRequest(pullRequest, {
          isAuthor: existing?.isAuthor ?? false,
          isAssignee: true,
          isReviewer: existing?.isReviewer ?? false
        })
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch assigned PRs: ${message}`)
  }

  try {
    const reviewRequested = await fetchReviewRequestedPullRequests(client)

    for (const pullRequest of reviewRequested) {
      const existing = pullRequestMap.get(pullRequest.id)

      pullRequestMap.set(
        pullRequest.id,
        transformPullRequest(pullRequest, {
          isAuthor: existing?.isAuthor ?? false,
          isAssignee: existing?.isAssignee ?? false,
          isReviewer: true
        })
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch review-requested PRs: ${message}`)
  }

  const pullRequestsToSync = Array.from(pullRequestMap.values())

  for (const pullRequest of pullRequestsToSync) {
    await database
      .insert(pullRequests)
      .values(pullRequest)
      .onConflictDoUpdate({
        target: pullRequests.id,
        set: {
          number: pullRequest.number,
          title: pullRequest.title,
          state: pullRequest.state,
          url: pullRequest.url,
          repositoryOwner: pullRequest.repositoryOwner,
          repositoryName: pullRequest.repositoryName,
          authorLogin: pullRequest.authorLogin,
          authorAvatarUrl: pullRequest.authorAvatarUrl,
          createdAt: pullRequest.createdAt,
          updatedAt: pullRequest.updatedAt,
          closedAt: pullRequest.closedAt,
          mergedAt: pullRequest.mergedAt,
          isAuthor: pullRequest.isAuthor,
          isAssignee: pullRequest.isAssignee,
          isReviewer: pullRequest.isReviewer,
          labels: pullRequest.labels,
          assignees: pullRequest.assignees,
          syncedAt: pullRequest.syncedAt
        }
      })
  }

  return {
    synced: pullRequestsToSync.length,
    errors
  }
}
