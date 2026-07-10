import { Effect, Layer, Option, Ref } from 'effect'
import { describe, expect, it } from 'vitest'

import { modifiedFiles, type ModifiedFile } from '../../database/schema'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { syncFiles, type SyncFilesParams } from './sync-files'

interface InsertRecord {
  table: string
  values: Record<string, unknown>
  conflictUpdateKeys: string[]
}

interface UpdateRecord {
  table: string
  set: Record<string, unknown>
}

interface MutationLog {
  inserts: InsertRecord[]
  updates: UpdateRecord[]
}

// Build a fake drizzle `db` instance that records inserts/updates and returns
// pre-seeded rows from `select(...).from(table).where(...).all()`. The cast to
// `never` matches the `Database.use<A>(_, fn: (db: never) => A)` shape used by
// the stub Layer.
const makeFakeDb = (
  selectRows: ReadonlyArray<ModifiedFile>,
  log: MutationLog
) => {
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
              table: table === modifiedFiles ? 'modifiedFiles' : 'unknown',
              values,
              conflictUpdateKeys: Object.keys(config.set)
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
              table: table === modifiedFiles ? 'modifiedFiles' : 'unknown',
              set
            })
          }
        })
      })
    })
  }

  return fakeDb as never
}

const makeDatabaseLayer = (
  selectRows: ReadonlyArray<ModifiedFile>,
  log: MutationLog
) =>
  Layer.succeed(Database, {
    use: <A>(_operation: string, fn: (db: never) => A) =>
      Effect.sync(() => fn(makeFakeDb(selectRows, log)))
  })

interface RestPage {
  filename: string
}

const makeRestLayer = (
  pages: ReadonlyArray<ReadonlyArray<RestPage>> | 'none',
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

const params: SyncFilesParams = {
  pullRequestId: 'PR_1',
  owner: 'octocat',
  repositoryName: 'demo',
  pullNumber: 42
}

const seededFile = (overrides: Partial<ModifiedFile>): ModifiedFile => ({
  id: 'mf_existing',
  pullRequestId: params.pullRequestId,
  filename: 'a.ts',
  filePath: 'a.ts',
  previousFilename: null,
  status: 'modified',
  additions: 1,
  deletions: 0,
  changes: 1,
  diffHunk: null,
  blobSha: null,
  syncedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides
})

describe('syncFiles', () => {
  it('short-circuits when the transport reports 304 (Option.none)', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    await Effect.runPromise(
      Effect.provide(
        syncFiles(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer('none', callsRef)
        )
      )
    )

    expect(log.inserts).toEqual([])
    expect(log.updates).toEqual([])
  })

  it('soft-deletes rows that are no longer returned by the API', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    const existing: ReadonlyArray<ModifiedFile> = [
      seededFile({ id: 'mf_a', filename: 'a.ts' }),
      seededFile({ id: 'mf_b', filename: 'b.ts' })
    ]

    await Effect.runPromise(
      Effect.provide(
        syncFiles(params),
        Layer.mergeAll(
          makeDatabaseLayer(existing, log),
          makeRestLayer([[{ filename: 'a.ts' }]], callsRef)
        )
      )
    )

    expect(log.inserts.length).toEqual(1)
    expect(log.inserts[0].values.filename).toEqual('a.ts')

    const deletions = log.updates.filter(
      (entry) =>
        entry.set.deletedAt !== null && entry.set.deletedAt !== undefined
    )

    expect(deletions.length).toEqual(1)
  })

  it('upserts every file across paginated responses', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    const firstPage: ReadonlyArray<RestPage> = Array.from(
      { length: 100 },
      (_, index) => ({ filename: `file-${index}.ts` })
    )

    const secondPage: ReadonlyArray<RestPage> = Array.from(
      { length: 5 },
      (_, index) => ({ filename: `file-${100 + index}.ts` })
    )

    await Effect.runPromise(
      Effect.provide(
        syncFiles(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer([firstPage, secondPage], callsRef)
        )
      )
    )

    const calls = await Effect.runPromise(Ref.get(callsRef))

    expect(calls).toEqual(2)
    expect(log.inserts.length).toEqual(105)
    expect(log.inserts[0].values.filename).toEqual('file-0.ts')
    expect(log.inserts[104].values.filename).toEqual('file-104.ts')
  })
})
