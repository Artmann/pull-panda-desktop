import { and, eq, isNull } from 'drizzle-orm'
import { Effect } from 'effect'

import { comments } from '../../../database/schema'
import type {
  DatabaseNotInitializedError,
  DatabaseQueryError,
  NotFoundError
} from '../../../sync/errors'
import { Database } from '../../../sync/services/database'
import { Repository } from '../../services/repository'

export interface CommentSummary {
  readonly body: string | null
  readonly createdAt: string | null
  readonly id: string
  readonly line: number | null
  readonly path: string | null
  readonly reviewId: string | null
  readonly userLogin: string | null
}

export const listComments = (
  pullRequestId: string
): Effect.Effect<
  ReadonlyArray<CommentSummary>,
  DatabaseNotInitializedError | DatabaseQueryError | NotFoundError,
  Database | Repository
> =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const database = yield* Database

    yield* repository.requirePullRequestById(pullRequestId)

    const rows = yield* database.use('listComments', (db) =>
      db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.pullRequestId, pullRequestId),
            isNull(comments.deletedAt)
          )
        )
        .all()
    )

    return rows.map((row) => ({
      body: row.body,
      createdAt: row.gitHubCreatedAt,
      id: row.id,
      line: row.line,
      path: row.path,
      reviewId: row.reviewId,
      userLogin: row.userLogin
    }))
  })
