import { Effect, Option } from 'effect'
import { eq } from 'drizzle-orm'

import { commits, type NewCommit } from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import { CommitsResponseSchema, type Commit } from '../schemas/github-rest'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { paginateRest } from '../shared/paginate'
import { reconcileBySoftDelete } from '../shared/reconcile'
import { generateId, normalizeCommentBody } from '../shared/utils'

export interface SyncCommitsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const commitAuthorFields = (commitData: Commit) => ({
  authorLogin:
    commitData.author?.login ?? commitData.commit.author?.name ?? null,
  authorAvatarUrl: commitData.author?.avatar_url ?? null,
  gitHubCreatedAt: commitData.commit.author?.date ?? null
})

const buildCommitRecord = (
  commitData: Commit,
  existingId: string | undefined,
  pullRequestId: string,
  now: string
): NewCommit => ({
  id: existingId ?? generateId(),
  gitHubId: commitData.sha,
  pullRequestId,
  hash: commitData.sha,
  message: commitData.commit.message
    ? normalizeCommentBody(commitData.commit.message)
    : null,
  url: commitData.html_url ?? null,
  ...commitAuthorFields(commitData),
  linesAdded: null,
  linesRemoved: null,
  syncedAt: now,
  deletedAt: null
})

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

    const commitsData = result.value as ReadonlyArray<Commit>
    const now = new Date().toISOString()

    yield* database.use('syncCommits', (db) => {
      reconcileBySoftDelete(db, commits, {
        scope: [eq(commits.pullRequestId, params.pullRequestId)],
        items: commitsData,
        keyOfItem: (commit) => commit.sha,
        keyOfRow: (row) => row.gitHubId,
        build: (commit, existingId) =>
          buildCommitRecord(commit, existingId, params.pullRequestId, now),
        now
      })
    })
  })
