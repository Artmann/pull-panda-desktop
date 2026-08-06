import { Effect, Layer, Option, Ref } from 'effect'

import { Database } from '../../services/database'
import { GitHubRest } from '../../services/github-rest'

interface InsertRecord {
  conflictUpdateKeys: string[]
  table: string
  values: Record<string, unknown>
}

export interface MutationLog {
  inserts: InsertRecord[]
  updates: UpdateRecord[]
}

interface PullRequestSyncParams {
  owner: string
  pullNumber: number
  pullRequestId: string
  repositoryName: string
}

interface TableIdentity {
  table: unknown
  tableName: string
}

interface UpdateRecord {
  set: Record<string, unknown>
  table: string
}

// Build a fake drizzle `db` instance that records inserts/updates and returns
// pre-seeded rows from `select(...).from(table).where(...).all()`. The cast to
// `never` matches the `Database.use<A>(_, fn: (db: never) => A)` shape used by
// the stub Layer.
const makeFakeDb = <Row>(
  identity: TableIdentity,
  selectRows: ReadonlyArray<Row>,
  log: MutationLog
) => {
  const labelForTable = (table: unknown) =>
    table === identity.table ? identity.tableName : 'unknown'

  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          all: () => selectRows
        })
      })
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: (config: { set: Record<string, unknown> }) => ({
          run: () => {
            log.inserts.push({
              conflictUpdateKeys: Object.keys(config.set),
              table: labelForTable(table),
              values
            })
          }
        })
      })
    }),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: () => ({
          run: () => {
            log.updates.push({
              set,
              table: labelForTable(table)
            })
          }
        })
      })
    })
  }

  return fakeDb as never
}

export const makeDatabaseLayerFactory =
  <Row>(identity: TableIdentity) =>
  (selectRows: ReadonlyArray<Row>, log: MutationLog) =>
    Layer.succeed(Database, {
      use: <A>(_operation: string, fn: (db: never) => A) =>
        Effect.sync(() => fn(makeFakeDb(identity, selectRows, log)))
    })

// Stub GitHubRest transport. `'none'` simulates a 304 (Option.none); otherwise
// each inner array is served as one page, with empty pages after the last one.
export const makeRestLayer = <Entry>(
  pages: ReadonlyArray<ReadonlyArray<Entry>> | 'none',
  callsRef: Ref.Ref<number>
) =>
  Layer.succeed(GitHubRest, {
    request: <A>(
      _route: string,
      params: Record<string, unknown>,
      _schema: unknown,
      _options?: unknown
    ) =>
      Effect.gen(function* () {
        yield* Ref.update(callsRef, (count) => count + 1)

        if (pages === 'none') {
          return Option.none<A>()
        }

        const pageNumber = (params.page as number | undefined) ?? 1
        const page = pages[pageNumber - 1]

        if (!page) {
          return Option.some([] as unknown as A)
        }

        return Option.some(page as unknown as A)
      })
  })

export const pullRequestSyncParams: PullRequestSyncParams = {
  owner: 'octocat',
  pullNumber: 42,
  pullRequestId: 'PR_1',
  repositoryName: 'demo'
}
