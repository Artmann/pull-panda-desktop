import { and, eq, isNull } from 'drizzle-orm'
import { Effect } from 'effect'

import { modifiedFiles } from '../../../database/schema'
import type {
  DatabaseNotInitializedError,
  DatabaseQueryError,
  NotFoundError
} from '../../../sync/errors'
import { Database } from '../../../sync/services/database'
import { Repository } from '../../services/repository'

export interface ModifiedFileSummary {
  readonly additions: number | null
  readonly changes: number | null
  readonly deletions: number | null
  readonly filePath: string
  readonly previousFilename: string | null
  readonly status: string | null
}

type ListFilesError =
  | DatabaseNotInitializedError
  | DatabaseQueryError
  | NotFoundError

const liveFileRows = (pullRequestId: string) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const database = yield* Database

    yield* repository.requirePullRequestById(pullRequestId)

    return yield* database.use('listFiles', (db) =>
      db
        .select()
        .from(modifiedFiles)
        .where(
          and(
            eq(modifiedFiles.pullRequestId, pullRequestId),
            isNull(modifiedFiles.deletedAt)
          )
        )
        .all()
    )
  })

export const listFiles = (
  pullRequestId: string
): Effect.Effect<
  ReadonlyArray<ModifiedFileSummary>,
  ListFilesError,
  Database | Repository
> =>
  Effect.map(liveFileRows(pullRequestId), (rows) =>
    rows.map((row) => ({
      additions: row.additions,
      changes: row.changes,
      deletions: row.deletions,
      filePath: row.filePath,
      previousFilename: row.previousFilename,
      status: row.status
    }))
  )

export const getFileDiff = (
  pullRequestId: string,
  filePath: string
): Effect.Effect<string | null, ListFilesError, Database | Repository> =>
  Effect.map(
    liveFileRows(pullRequestId),
    (rows) => rows.find((row) => row.filePath === filePath)?.diffHunk ?? null
  )
