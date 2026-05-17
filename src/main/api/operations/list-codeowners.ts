import { Effect } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import { modifiedFiles } from '../../../database/schema'
import { Database } from '../../../sync/services/database'
import { Codeowners } from '../../services/codeowners'
import { Repository } from '../../services/repository'
import type { CodeownerMatch } from '../../codeowners'

export interface ListCodeownersInput {
  readonly owner: string
  readonly pullRequestId: string | null
  readonly repo: string
  readonly token: string
}

export interface ListCodeownersResult {
  readonly owners: ReadonlyArray<CodeownerMatch>
}

export const listCodeowners = (input: ListCodeownersInput) =>
  Effect.gen(function* () {
    const codeowners = yield* Codeowners
    const database = yield* Database
    const repository = yield* Repository

    const rules = yield* codeowners.fetchRules({
      owner: input.owner,
      repo: input.repo,
      token: input.token
    })

    const pullRequestId = input.pullRequestId

    if (!pullRequestId) {
      return { owners: [] as ReadonlyArray<CodeownerMatch> }
    }

    yield* repository.requirePullRequestById(pullRequestId)

    const files = yield* database.use('listCodeowners.modifiedFiles', (db) =>
      db
        .select({ filePath: modifiedFiles.filePath })
        .from(modifiedFiles)
        .where(
          and(
            eq(modifiedFiles.pullRequestId, pullRequestId),
            isNull(modifiedFiles.deletedAt)
          )
        )
        .all()
    )

    const owners = codeowners.matchOwners({
      changedPaths: files.map((file) => file.filePath),
      rules
    })

    return { owners }
  })
