import { Effect, Layer, Ref } from 'effect'
import { describe, expect, it } from 'vitest'

import { modifiedFiles, type ModifiedFile } from '../../database/schema'
import {
  makeDatabaseLayerFactory,
  makeRestLayer,
  pullRequestSyncParams,
  type MutationLog
} from './__test-helpers__/stub-layers'
import { syncFiles, type SyncFilesParams } from './sync-files'

interface RestPage {
  filename: string
}

const makeDatabaseLayer = makeDatabaseLayerFactory<ModifiedFile>({
  table: modifiedFiles,
  tableName: 'modifiedFiles'
})

const params: SyncFilesParams = pullRequestSyncParams

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
