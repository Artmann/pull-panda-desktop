import { and, eq, isNull } from 'drizzle-orm'
import { Effect } from 'effect'

import { reviews } from '../../../database/schema'
import type {
  DatabaseNotInitializedError,
  DatabaseQueryError,
  NotFoundError
} from '../../../sync/errors'
import { Database } from '../../../sync/services/database'
import { Repository } from '../../services/repository'

export interface ReviewSummary {
  readonly authorLogin: string | null
  readonly body: string | null
  readonly id: string
  readonly state: string
  readonly submittedAt: string | null
}

export const listReviews = (
  pullRequestId: string
): Effect.Effect<
  ReadonlyArray<ReviewSummary>,
  DatabaseNotInitializedError | DatabaseQueryError | NotFoundError,
  Database | Repository
> =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const database = yield* Database

    yield* repository.requirePullRequestById(pullRequestId)

    const rows = yield* database.use('listReviews', (db) =>
      db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.pullRequestId, pullRequestId),
            isNull(reviews.deletedAt)
          )
        )
        .all()
    )

    return rows.map((row) => ({
      authorLogin: row.authorLogin,
      body: row.body,
      id: row.id,
      state: row.state,
      submittedAt: row.gitHubSubmittedAt
    }))
  })
