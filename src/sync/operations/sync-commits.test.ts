import { Effect, Layer, Ref } from 'effect'
import { describe, expect, it } from 'vitest'

import { commits, type Commit } from '../../database/schema'
import {
  makeDatabaseLayerFactory,
  makeRestLayer,
  pullRequestSyncParams,
  type MutationLog
} from './__test-helpers__/stub-layers'
import { syncCommits, type SyncCommitsParams } from './sync-commits'

interface CommitResponseEntry {
  sha: string
  commit: {
    message: string
    author?: { name?: string; date?: string }
  }
  html_url?: string
  author?: { login?: string; avatar_url?: string } | null
}

const makeDatabaseLayer = makeDatabaseLayerFactory<Commit>({
  table: commits,
  tableName: 'commits'
})

const params: SyncCommitsParams = pullRequestSyncParams

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
