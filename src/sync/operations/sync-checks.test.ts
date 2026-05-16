import { Effect, Layer, Option } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'

import { checks, type Check } from '../../database/schema'
import { Database } from '../services/database'
import { EtagStore } from '../services/etag-store'
import { GitHubRest } from '../services/github-rest'
import {
  __checksTesting,
  syncChecks,
  type SyncChecksParams
} from './sync-checks'

interface InsertRecord {
  table: 'checks' | 'unknown'
  values: Record<string, unknown>
}

interface UpdateRecord {
  table: 'checks' | 'unknown'
  set: Record<string, unknown>
  whereSnapshot: string
}

interface MutationLog {
  inserts: InsertRecord[]
  updates: UpdateRecord[]
}

const tableName = (table: unknown): InsertRecord['table'] =>
  table === checks ? 'checks' : 'unknown'

// Drizzle's `eq(column, value)` returns an AST object with circular references
// (column ↔ table). We can't `JSON.stringify` it, so we walk the tree manually
// and collect every string/number leaf into a flat list. Tests use
// `.includes(rowId)` to check whether a given row id appears anywhere in the
// where-clause arguments — that's enough to attribute a soft-delete to a row.
const collectLiterals = (value: unknown, seen: WeakSet<object>): string[] => {
  if (value === null || value === undefined) {
    return []
  }

  if (typeof value === 'string') {
    return [value]
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }

  if (typeof value !== 'object') {
    return []
  }

  const objectValue = value as object

  if (seen.has(objectValue)) {
    return []
  }

  seen.add(objectValue)

  const literals: string[] = []

  if (Array.isArray(value)) {
    for (const entry of value) {
      literals.push(...collectLiterals(entry, seen))
    }

    return literals
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    literals.push(...collectLiterals(entry, seen))
  }

  return literals
}

const snapshotWhere = (args: unknown[]): string =>
  collectLiterals(args, new WeakSet()).join('|')

const makeFakeDb = (initialChecks: ReadonlyArray<Check>, log: MutationLog) => {
  let activeChecks = [...initialChecks]

  const fakeDb = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          all: () => (tableName(table) === 'checks' ? [...activeChecks] : [])
        })
      })
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: () => ({
          run: () => {
            log.inserts.push({ table: tableName(table), values })
          }
        })
      })
    }),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: (...args: unknown[]) => ({
          run: () => {
            const whereSnapshot = snapshotWhere(args)

            log.updates.push({ table: tableName(table), set, whereSnapshot })

            if (
              tableName(table) === 'checks' &&
              set.deletedAt !== null &&
              set.deletedAt !== undefined
            ) {
              activeChecks = activeChecks.filter(
                (row) => !whereSnapshot.includes(row.id)
              )
            }
          }
        })
      })
    })
  }

  return fakeDb as never
}

const makeDatabaseLayer = (
  initialChecks: ReadonlyArray<Check>,
  log: MutationLog
) =>
  Layer.succeed(Database, {
    use: <A>(_operation: string, fn: (db: never) => A) =>
      Effect.sync(() => fn(makeFakeDb(initialChecks, log)))
  })

const StubEtagStore = Layer.succeed(EtagStore, {
  get: () => Effect.succeed(Option.none()),
  set: () => Effect.void,
  remove: () => Effect.void
})

interface CheckRunPayload {
  id: number
  name: string
  status: string | null
  conclusion: string | null
  started_at: string | null
  completed_at: string | null
  details_url: string | null
  head_sha: string
}

interface RestPlan {
  headSha: string | 'none'
  checkRuns: ReadonlyArray<ReadonlyArray<CheckRunPayload>> | 'none'
}

const makeRestLayer = (plan: RestPlan) =>
  Layer.succeed(GitHubRest, {
    request: <A>(
      route: string,
      params: Record<string, unknown>,
      _schema: unknown,
      _options?: unknown
    ) =>
      Effect.sync(() => {
        if (
          route.includes('/pulls/{pull_number}') &&
          !route.includes('check-runs')
        ) {
          if (plan.headSha === 'none') {
            return Option.none<A>()
          }

          return Option.some({ head: { sha: plan.headSha } } as unknown as A)
        }

        if (route.includes('check-runs')) {
          if (plan.checkRuns === 'none') {
            return Option.none<A>()
          }

          const page = (params.page as number | undefined) ?? 1
          const slice = plan.checkRuns[page - 1] ?? []

          return Option.some({
            total_count: slice.length,
            check_runs: slice
          } as unknown as A)
        }

        return Option.none<A>()
      })
  })

const params: SyncChecksParams = {
  pullRequestId: 'PR_1',
  owner: 'octocat',
  repositoryName: 'demo',
  pullNumber: 42
}

const seededCheck = (overrides: Partial<Check>): Check => ({
  id: 'check_existing',
  gitHubId: '1',
  pullRequestId: params.pullRequestId,
  name: 'lint',
  state: 'completed',
  conclusion: 'success',
  commitSha: 'sha-existing',
  suiteName: null,
  durationInSeconds: null,
  detailsUrl: null,
  message: null,
  url: null,
  gitHubCreatedAt: '2026-01-01T00:00:00Z',
  gitHubUpdatedAt: '2026-01-01T00:00:00Z',
  syncedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  ...overrides
})

const buildCheckRun = (
  overrides: Partial<CheckRunPayload> & Pick<CheckRunPayload, 'id' | 'name'>
): CheckRunPayload => ({
  id: overrides.id,
  name: overrides.name,
  status: 'completed',
  conclusion: 'success',
  started_at: '2026-02-01T00:00:00Z',
  completed_at: '2026-02-01T00:01:00Z',
  details_url: null,
  head_sha: 'sha-abc',
  ...overrides
})

afterEach(() => {
  __checksTesting.clearHeadShaCache()
})

describe('syncChecks', () => {
  it('returns without writing when the head SHA cannot be resolved', async () => {
    const log: MutationLog = { inserts: [], updates: [] }

    await Effect.runPromise(
      Effect.provide(
        syncChecks(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer({ headSha: 'none', checkRuns: 'none' }),
          StubEtagStore
        )
      )
    )

    expect(log.inserts).toEqual([])
    expect(log.updates).toEqual([])
  })

  it('short-circuits when the check-runs endpoint returns 304', async () => {
    const log: MutationLog = { inserts: [], updates: [] }

    await Effect.runPromise(
      Effect.provide(
        syncChecks(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer({ headSha: 'sha-abc', checkRuns: 'none' }),
          StubEtagStore
        )
      )
    )

    expect(log.inserts).toEqual([])
    expect(log.updates).toEqual([])
  })

  it('soft-deletes existing checks not returned by the API', async () => {
    const log: MutationLog = { inserts: [], updates: [] }

    const initial: ReadonlyArray<Check> = [
      seededCheck({ id: 'check_a', gitHubId: '1', name: 'lint' }),
      seededCheck({ id: 'check_b', gitHubId: '2', name: 'typecheck' })
    ]

    await Effect.runPromise(
      Effect.provide(
        syncChecks(params),
        Layer.mergeAll(
          makeDatabaseLayer(initial, log),
          makeRestLayer({
            headSha: 'sha-abc',
            checkRuns: [[buildCheckRun({ id: 1, name: 'lint' })]]
          }),
          StubEtagStore
        )
      )
    )

    const deletions = log.updates.filter(
      (entry) =>
        entry.table === 'checks' &&
        entry.set.deletedAt !== null &&
        entry.set.deletedAt !== undefined
    )

    expect(deletions.length).toBeGreaterThanOrEqual(1)
    expect(
      deletions.some((entry) => entry.whereSnapshot.includes('check_b'))
    ).toEqual(true)
  })

  it('dedupes duplicate (commitSha, name) rows and keeps the fresher one', async () => {
    const log: MutationLog = { inserts: [], updates: [] }

    // Two locally-stored active checks that collide on (commitSha, name). The
    // API returns one canonical check_run; after the upsert + dedup passes, the
    // older duplicate row should be marked deleted.
    const initial: ReadonlyArray<Check> = [
      seededCheck({
        id: 'check_old',
        gitHubId: '1',
        name: 'lint',
        commitSha: 'sha-abc',
        gitHubUpdatedAt: '2026-01-01T00:00:00Z'
      }),
      seededCheck({
        id: 'check_new',
        gitHubId: '2',
        name: 'lint',
        commitSha: 'sha-abc',
        gitHubUpdatedAt: '2026-02-01T00:00:00Z'
      })
    ]

    await Effect.runPromise(
      Effect.provide(
        syncChecks(params),
        Layer.mergeAll(
          makeDatabaseLayer(initial, log),
          makeRestLayer({
            headSha: 'sha-abc',
            checkRuns: [
              [
                buildCheckRun({ id: 1, name: 'lint' }),
                buildCheckRun({ id: 2, name: 'lint' })
              ]
            ]
          }),
          StubEtagStore
        )
      )
    )

    const dedupDeletes = log.updates.filter(
      (entry) =>
        entry.table === 'checks' &&
        entry.set.deletedAt !== null &&
        entry.set.deletedAt !== undefined &&
        entry.whereSnapshot.includes('check_old')
    )

    const keepDeletes = log.updates.filter(
      (entry) =>
        entry.table === 'checks' &&
        entry.set.deletedAt !== null &&
        entry.set.deletedAt !== undefined &&
        entry.whereSnapshot.includes('check_new')
    )

    expect(dedupDeletes.length).toBeGreaterThanOrEqual(1)
    expect(keepDeletes.length).toEqual(0)
  })
})
