import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import { commits, type NewCommit } from '../database/schema'

import { createRestClient } from './restClient'
import { etagManager } from './etagManager'
import { generateId, normalizeCommentBody } from './utils'

interface SyncCommitsParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

interface CommitData {
  sha: string
  commit: {
    message: string
    author?: {
      name?: string
      date?: string
    }
  }
  html_url?: string
  author?: {
    login?: string
    avatar_url?: string
  }
}

export async function syncCommits({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncCommitsParams): Promise<void> {
  console.time('syncCommits')

  try {
    const client = createRestClient(token)
    const etagKey = { endpointType: 'commits', resourceId: pullRequestId }

    // Look up cached ETag
    const cached = etagManager.get(etagKey)

    const result = await client.request<CommitData[]>(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
      {
        owner,
        repo: repositoryName,
        pull_number: pullNumber,
        per_page: 100
      },
      { etag: cached?.etag ?? undefined }
    )

    // Skip processing on 304 Not Modified
    if (result.notModified) {
      console.log(`[syncCommits] No changes for PR #${pullNumber} (304)`)
      console.timeEnd('syncCommits')

      return
    }

    const commitsData = result.data ?? []

    console.log(
      `Found ${commitsData.length} commits for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingCommits = database
      .select()
      .from(commits)
      .where(
        and(eq(commits.pullRequestId, pullRequestId), isNull(commits.deletedAt))
      )
      .all()

    const syncedGitHubIds: string[] = []

    for (const commitData of commitsData) {
      const gitHubId = commitData.sha
      syncedGitHubIds.push(gitHubId)

      const existingCommit = existingCommits.find(
        (c) => c.gitHubId === gitHubId
      )

      const commit: NewCommit = {
        id: existingCommit?.id ?? generateId(),
        gitHubId,
        pullRequestId,
        hash: commitData.sha,
        message: commitData.commit.message
          ? normalizeCommentBody(commitData.commit.message)
          : null,
        url: commitData.html_url ?? null,
        authorLogin: commitData.author?.login ?? commitData.commit.author?.name ?? null,
        authorAvatarUrl: commitData.author?.avatar_url ?? null,
        linesAdded: null,
        linesRemoved: null,
        gitHubCreatedAt: commitData.commit.author?.date ?? null,
        syncedAt: now,
        deletedAt: null
      }

      database
        .insert(commits)
        .values(commit)
        .onConflictDoUpdate({
          target: commits.id,
          set: {
            hash: commit.hash,
            message: commit.message,
            url: commit.url,
            authorLogin: commit.authorLogin,
            authorAvatarUrl: commit.authorAvatarUrl,
            linesAdded: commit.linesAdded,
            linesRemoved: commit.linesRemoved,
            gitHubCreatedAt: commit.gitHubCreatedAt,
            syncedAt: commit.syncedAt,
            deletedAt: null
          }
        })
        .run()
    }

    for (const existingCommit of existingCommits) {
      if (!syncedGitHubIds.includes(existingCommit.gitHubId)) {
        database
          .update(commits)
          .set({ deletedAt: now })
          .where(eq(commits.id, existingCommit.id))
          .run()
      }
    }

    // Store the new ETag
    if (result.etag) {
      etagManager.set(etagKey, result.etag, result.lastModified ?? undefined)
    }

    console.timeEnd('syncCommits')
  } catch (error) {
    console.timeEnd('syncCommits')
    console.error('Error syncing pull request commits:', error)

    throw error
  }
}
