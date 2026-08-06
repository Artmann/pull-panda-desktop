import { Effect, Option } from 'effect'
import { eq } from 'drizzle-orm'

import { modifiedFiles, type NewModifiedFile } from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import { FilesResponseSchema, type ModifiedFile } from '../schemas/github-rest'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { paginateRest } from '../shared/paginate'
import { reconcileBySoftDelete } from '../shared/reconcile'
import { generateId } from '../shared/utils'

export interface SyncFilesParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const buildModifiedFileRecord = (
  fileData: ModifiedFile,
  existingId: string | undefined,
  pullRequestId: string,
  now: string
): NewModifiedFile => ({
  id: existingId ?? generateId(),
  pullRequestId,
  filename: fileData.filename,
  filePath: fileData.filename,
  previousFilename: fileData.previous_filename ?? null,
  status: fileData.status ?? null,
  additions: fileData.additions ?? null,
  deletions: fileData.deletions ?? null,
  changes: fileData.changes ?? null,
  diffHunk: fileData.patch ?? null,
  blobSha: fileData.sha ?? null,
  syncedAt: now,
  deletedAt: null
})

export const syncFiles = (
  params: SyncFilesParams
): Effect.Effect<void, SyncError, Database | GitHubRest> =>
  Effect.gen(function* () {
    const database = yield* Database

    const result = yield* paginateRest(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner: params.owner,
        repo: params.repositoryName,
        pull_number: params.pullNumber
      },
      FilesResponseSchema,
      {
        etagKey: { endpointType: 'files', resourceId: params.pullRequestId }
      }
    ).pipe(
      Effect.mapError(
        (cause) =>
          new SyncDetailFailedError({
            operation: 'files',
            pullRequestId: params.pullRequestId,
            cause
          }) as SyncError
      )
    )

    if (Option.isNone(result)) {
      return
    }

    const filesData = result.value as ReadonlyArray<ModifiedFile>
    const now = new Date().toISOString()

    yield* database.use('syncFiles', (db) => {
      reconcileBySoftDelete(db, modifiedFiles, {
        scope: [eq(modifiedFiles.pullRequestId, params.pullRequestId)],
        items: filesData,
        keyOfItem: (file) => file.filename,
        keyOfRow: (row) => row.filename,
        build: (file, existingId) =>
          buildModifiedFileRecord(file, existingId, params.pullRequestId, now),
        now
      })
    })
  })
