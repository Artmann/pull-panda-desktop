import { Effect, Option } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import { modifiedFiles, type NewModifiedFile } from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import { FilesResponseSchema, type ModifiedFile } from '../schemas/github-rest'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { paginateRest } from '../shared/paginate'
import { generateId } from '../shared/utils'

export interface SyncFilesParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

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

    const filesData = result.value
    const now = new Date().toISOString()

    yield* database.use('syncFiles', (db) => {
      const existingFiles = db
        .select()
        .from(modifiedFiles)
        .where(
          and(
            eq(modifiedFiles.pullRequestId, params.pullRequestId),
            isNull(modifiedFiles.deletedAt)
          )
        )
        .all()

      const syncedFilenames: string[] = []

      for (const fileData of filesData as ReadonlyArray<ModifiedFile>) {
        const filename = fileData.filename
        syncedFilenames.push(filename)

        const existingFile = existingFiles.find(
          (row) => row.filename === filename
        )

        const file: NewModifiedFile = {
          id: existingFile?.id ?? generateId(),
          pullRequestId: params.pullRequestId,
          filename,
          filePath: filename,
          status: fileData.status ?? null,
          additions: fileData.additions ?? null,
          deletions: fileData.deletions ?? null,
          changes: fileData.changes ?? null,
          diffHunk: fileData.patch ?? null,
          syncedAt: now,
          deletedAt: null
        }

        db.insert(modifiedFiles)
          .values(file)
          .onConflictDoUpdate({
            target: modifiedFiles.id,
            set: {
              filename: file.filename,
              filePath: file.filePath,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
              diffHunk: file.diffHunk,
              syncedAt: file.syncedAt,
              deletedAt: null
            }
          })
          .run()
      }

      for (const existingFile of existingFiles) {
        if (!syncedFilenames.includes(existingFile.filename)) {
          db.update(modifiedFiles)
            .set({ deletedAt: now })
            .where(eq(modifiedFiles.id, existingFile.id))
            .run()
        }
      }
    })
  })
