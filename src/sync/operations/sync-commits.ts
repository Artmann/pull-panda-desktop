import { Effect, Option } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import { commits, type NewCommit } from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import { CommitsResponseSchema, type Commit } from '../schemas/github-rest'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { paginateRest } from '../shared/paginate'
import { generateId, normalizeCommentBody } from '../shared/utils'

interface SyncCommitsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export const syncCommits = (
  params: SyncCommitsParams
): Effect.Effect<void, SyncError, Database | GitHubRest> =>
  Effect.gen(function* () {
    const database = yield* Database

    const result = yield* paginateRest(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
      {
        owner: params.owner,
        repo: params.repositoryName,
        pull_number: params.pullNumber
      },
      CommitsResponseSchema,
      {
        etagKey: { endpointType: 'commits', resourceId: params.pullRequestId }
      }
    ).pipe(
      Effect.mapError(
        (cause) =>
          new SyncDetailFailedError({
            operation: 'commits',
            pullRequestId: params.pullRequestId,
            cause
          }) as SyncError
      )
    )

    if (Option.isNone(result)) {
      return
    }

    const commitsData = result.value
    const now = new Date().toISOString()

    yield* database.use('syncCommits', (db) => {
      const existingCommits = db
        .select()
        .from(commits)
        .where(
          and(
            eq(commits.pullRequestId, params.pullRequestId),
            isNull(commits.deletedAt)
          )
        )
        .all()

      const syncedGitHubIds: string[] = []

      for (const commitData of commitsData as ReadonlyArray<Commit>) {
        const gitHubId = commitData.sha
        syncedGitHubIds.push(gitHubId)

        const existingCommit = existingCommits.find(
          (row) => row.gitHubId === gitHubId
        )

        const commit: NewCommit = {
          id: existingCommit?.id ?? generateId(),
          gitHubId,
          pullRequestId: params.pullRequestId,
          hash: commitData.sha,
          message: commitData.commit.message
            ? normalizeCommentBody(commitData.commit.message)
            : null,
          url: commitData.html_url ?? null,
          authorLogin:
            commitData.author?.login ?? commitData.commit.author?.name ?? null,
          authorAvatarUrl: commitData.author?.avatar_url ?? null,
          linesAdded: null,
          linesRemoved: null,
          gitHubCreatedAt: commitData.commit.author?.date ?? null,
          syncedAt: now,
          deletedAt: null
        }

        db.insert(commits)
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
          db.update(commits)
            .set({ deletedAt: now })
            .where(eq(commits.id, existingCommit.id))
            .run()
        }
      }
    })
  })
