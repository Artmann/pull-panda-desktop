import { Effect } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import { checks } from '../../../database/schema'
import { Database } from '../../../sync/services/database'
import { checkFromRow } from '../../check-from-row'
import { Repository } from '../../services/repository'
import type { Check } from '../../../types/pull-request-details'

function isRunning(check: { state: string | null }): boolean {
  const state = check.state?.toLowerCase()

  return state === 'in_progress' || state === 'queued'
}

export interface ListChecksResult {
  readonly checks: ReadonlyArray<Check>
  readonly hasRunningChecks: boolean
}

export const listChecks = (
  pullRequestId: string
): Effect.Effect<
  ListChecksResult,
  | import('../../../sync/errors').NotFoundError
  | import('../../../sync/errors').DatabaseQueryError
  | import('../../../sync/errors').DatabaseNotInitializedError,
  Repository | Database
> =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const database = yield* Database

    yield* repository.requirePullRequestById(pullRequestId)

    const rows = yield* database.use('listChecks', (db) =>
      db
        .select()
        .from(checks)
        .where(
          and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
        )
        .all()
    )

    const parsed: Check[] = rows.map(checkFromRow)

    return {
      checks: parsed,
      hasRunningChecks: parsed.some(isRunning)
    }
  })
