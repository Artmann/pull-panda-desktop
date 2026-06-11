import { Effect, Layer, Option, Ref } from 'effect'
import { describe, expect, it } from 'vitest'

import { commits, type Commit } from '../../database/schema'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { syncCommits, type SyncCommitsParams } from './sync-commits'

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
const makeFakeDb = (selectRows: ReadonlyArray<Commit>, log: MutationLog) => {
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
              table: table === commits ? 'commits' : 'unknown',
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
              table: table === commits ? 'commits' : 'unknown',
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
  selectRows: ReadonlyArray<Commit>,
  log: MutationLog
) =>
  Layer.succeed(Database, {
    use: <A>(_operation: string, fn: (db: never) => A) =>
      Effect.sync(() => fn(makeFakeDb(selectRows, log)))
  })

interface CommitResponseEntry {
  sha: string
  commit: {
    message: string
    author?: { name?: string; date?: string }
  }
  html_url?: string
  author?: { login?: string; avatar_url?: string } | null
}

const makeRestLayer = (
  pages: ReadonlyArray<ReadonlyArray<CommitResponseEntry>> | 'none',
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

const params: SyncCommitsParams = {
  pullRequestId: 'PR_1',
  owner: 'octocat',
  repositoryName: 'demo',
  pullNumber: 42
}

const seededCommit = (overrides: Partial<Commit>): Commit => ({
  id: 'cm_existing',
  gitHubId: 'sha_existing',
  pullRequestId: params.pullRequestId,
  hash: 'sha_existing',
  message: 'old message',
  url: 'https://github.com/octocat/demo/commit/sha_existing',
  authorLogin: 'octocat',
  authorAvatarUrl: 'https://example.com/avatar.png',
  linesAdded: null,
  linesRemoved: null,
  gitHubCreatedAt: '2026-01-01T00:00:00Z',
  syncedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides
})

describe('syncCommits', () => {
  it('short-circuits when the transport reports 304 (Option.none)', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    await Effect.runPromise(
      Effect.provide(
        syncCommits(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer('none', callsRef)
        )
      )
    )

    expect(log.inserts).toEqual([])
    expect(log.updates).toEqual([])
  })

  it('upserts new commits with author details from the GitHub user', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    const apiCommits: ReadonlyArray<CommitResponseEntry> = [
      {
        sha: 'sha_1',
        commit: {
          message: 'Add feature',
          author: { name: 'The Octocat', date: '2026-02-01T00:00:00Z' }
        },
        html_url: 'https://github.com/octocat/demo/commit/sha_1',
        author: { login: 'octocat', avatar_url: 'https://example.com/a.png' }
      }
    ]

    await Effect.runPromise(
      Effect.provide(
        syncCommits(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer([apiCommits], callsRef)
        )
      )
    )

    expect(log.inserts.length).toEqual(1)
    expect(log.inserts[0].values).toEqual({
      id: log.inserts[0].values.id,
      gitHubId: 'sha_1',
      pullRequestId: 'PR_1',
      hash: 'sha_1',
      message: 'Add feature',
      url: 'https://github.com/octocat/demo/commit/sha_1',
      authorLogin: 'octocat',
      authorAvatarUrl: 'https://example.com/a.png',
      linesAdded: null,
      linesRemoved: null,
      gitHubCreatedAt: '2026-02-01T00:00:00Z',
      syncedAt: log.inserts[0].values.syncedAt,
      deletedAt: null
    })
    expect(log.updates).toEqual([])
  })

  it('falls back to the git author name and nulls when the GitHub user is missing', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    const apiCommits: ReadonlyArray<CommitResponseEntry> = [
      {
        sha: 'sha_2',
        commit: {
          message: '',
          author: { name: 'Jane Doe' }
        },
        author: null
      }
    ]

    await Effect.runPromise(
      Effect.provide(
        syncCommits(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer([apiCommits], callsRef)
        )
      )
    )

    expect(log.inserts.length).toEqual(1)
    expect(log.inserts[0].values).toEqual({
      id: log.inserts[0].values.id,
      gitHubId: 'sha_2',
      pullRequestId: 'PR_1',
      hash: 'sha_2',
      message: null,
      url: null,
      authorLogin: 'Jane Doe',
      authorAvatarUrl: null,
      linesAdded: null,
      linesRemoved: null,
      gitHubCreatedAt: null,
      syncedAt: log.inserts[0].values.syncedAt,
      deletedAt: null
    })
  })

  it('reuses the existing row id and soft-deletes commits no longer returned', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    const existing: ReadonlyArray<Commit> = [
      seededCommit({ id: 'cm_a', gitHubId: 'sha_a', hash: 'sha_a' }),
      seededCommit({ id: 'cm_b', gitHubId: 'sha_b', hash: 'sha_b' })
    ]

    const apiCommits: ReadonlyArray<CommitResponseEntry> = [
      {
        sha: 'sha_a',
        commit: { message: 'kept' }
      }
    ]

    await Effect.runPromise(
      Effect.provide(
        syncCommits(params),
        Layer.mergeAll(
          makeDatabaseLayer(existing, log),
          makeRestLayer([apiCommits], callsRef)
        )
      )
    )

    expect(log.inserts.length).toEqual(1)
    expect(log.inserts[0].values.id).toEqual('cm_a')
    expect(log.inserts[0].values.authorLogin).toEqual(null)

    const deletions = log.updates.filter(
      (entry) =>
        entry.set.deletedAt !== null && entry.set.deletedAt !== undefined
    )

    expect(deletions.length).toEqual(1)
  })

  it('upserts every commit across paginated responses', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const callsRef = Ref.unsafeMake(0)

    const firstPage: ReadonlyArray<CommitResponseEntry> = Array.from(
      { length: 100 },
      (_, index) => ({
        sha: `sha_${index}`,
        commit: { message: `commit ${index}` }
      })
    )

    const secondPage: ReadonlyArray<CommitResponseEntry> = Array.from(
      { length: 5 },
      (_, index) => ({
        sha: `sha_${100 + index}`,
        commit: { message: `commit ${100 + index}` }
      })
    )

    await Effect.runPromise(
      Effect.provide(
        syncCommits(params),
        Layer.mergeAll(
          makeDatabaseLayer([], log),
          makeRestLayer([firstPage, secondPage], callsRef)
        )
      )
    )

    const calls = await Effect.runPromise(Ref.get(callsRef))

    expect(calls).toEqual(2)
    expect(log.inserts.length).toEqual(105)
    expect(log.inserts[0].values.gitHubId).toEqual('sha_0')
    expect(log.inserts[104].values.gitHubId).toEqual('sha_104')
  })
})
