import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import { commits, type NewCommit } from '../database/schema'

import { createGraphqlClient } from './graphql'
import { commitsQuery, type CommitsQueryResponse } from './queries'
import { generateId, normalizeCommentBody } from './utils'

interface SyncCommitsParams {
  client: ReturnType<typeof createGraphqlClient>
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export async function syncCommits({
  client,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncCommitsParams): Promise<void> {
  console.time('syncCommits')

  try {
    const response = await client<CommitsQueryResponse>(commitsQuery, {
      owner,
      repo: repositoryName,
      pullNumber
    })

    const commitsData =
      response.repository?.pullRequest?.commits?.nodes?.filter(
        (node) => node !== null
      ) ?? []

    console.log(
      `Found ${commitsData.length} commits for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingCommits = await database
      .select()
      .from(commits)
      .where(
        and(eq(commits.pullRequestId, pullRequestId), isNull(commits.deletedAt))
      )

    const syncedGitHubIds: string[] = []

    for (const commitNode of commitsData) {
      if (!commitNode) {
        continue
      }

      const commitData = commitNode.commit
      const gitHubId = commitData.oid
      syncedGitHubIds.push(gitHubId)

      const existingCommit = existingCommits.find(
        (c) => c.gitHubId === gitHubId
      )

      const commit: NewCommit = {
        id: existingCommit?.id ?? generateId(),
        gitHubId,
        pullRequestId,
        hash: commitData.oid,
        message: commitData.message
          ? normalizeCommentBody(commitData.message)
          : null,
        url: commitData.url ?? null,
        authorLogin:
          commitData.author?.user?.login ?? commitData.author?.name ?? null,
        authorAvatarUrl: commitData.author?.avatarUrl ?? null,
        linesAdded: commitData.additions ?? null,
        linesRemoved: commitData.deletions ?? null,
        gitHubCreatedAt: commitData.authoredDate ?? null,
        syncedAt: now,
        deletedAt: null
      }

      await database
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
    }

    for (const existingCommit of existingCommits) {
      if (!syncedGitHubIds.includes(existingCommit.gitHubId)) {
        await database
          .update(commits)
          .set({ deletedAt: now })
          .where(eq(commits.id, existingCommit.id))
      }
    }

    console.timeEnd('syncCommits')
  } catch (error) {
    console.timeEnd('syncCommits')
    console.error('Error syncing pull request commits:', error)
    throw error
  }
}
