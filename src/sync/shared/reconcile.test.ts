import { createRequire } from 'node:module'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import initSqlJs from 'sql.js'
import { beforeEach, describe, expect, it } from 'vitest'

import * as schema from '../../database/schema'
import {
  commits,
  reviews,
  type NewCommit,
  type NewReview
} from '../../database/schema'
import { reconcileBySoftDelete } from './reconcile'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

const require = createRequire(import.meta.url)

async function makeInMemoryDatabase(): Promise<DrizzleDb> {
  const sqlJsMain = require.resolve('sql.js')
  const wasmPath = path.join(path.dirname(sqlJsMain), 'sql-wasm.wasm')
  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  const database = drizzle(new SQL.Database(), { schema })

  migrate(database, {
    migrationsFolder: path.join(process.cwd(), 'drizzle')
  })

  return database
}

const buildCommit = (
  sha: string,
  existingId: string | undefined,
  now: string
): NewCommit => ({
  id: existingId ?? `generated-${sha}`,
  gitHubId: sha,
  pullRequestId: 'PR_1',
  hash: sha,
  message: `message for ${sha}`,
  url: null,
  authorLogin: null,
  authorAvatarUrl: null,
  gitHubCreatedAt: null,
  linesAdded: null,
  linesRemoved: null,
  syncedAt: now,
  deletedAt: null
})

const reconcileCommits = (
  database: DrizzleDb,
  shas: ReadonlyArray<string>,
  now: string
) =>
  reconcileBySoftDelete(database, commits, {
    scope: [eq(commits.pullRequestId, 'PR_1')],
    items: shas,
    keyOfItem: (sha) => sha,
    keyOfRow: (row) => row.gitHubId,
    build: (sha, existingId) => buildCommit(sha, existingId, now),
    now
  })

describe('reconcileBySoftDelete', () => {
  let database: DrizzleDb

  beforeEach(async () => {
    database = await makeInMemoryDatabase()
  })

  it('inserts items that have no existing row', () => {
    reconcileCommits(database, ['sha-a', 'sha-b'], '2026-01-01T00:00:00.000Z')

    const rows = database
      .select()
      .from(commits)
      .where(eq(commits.pullRequestId, 'PR_1'))
      .all()

    expect(rows.map((row) => row.gitHubId).sort()).toEqual(['sha-a', 'sha-b'])
    expect(rows.every((row) => row.deletedAt === null)).toEqual(true)
  })

  it('reuses the existing row id so the upsert updates in place', () => {
    reconcileCommits(database, ['sha-a'], '2026-01-01T00:00:00.000Z')

    const firstRow = database
      .select()
      .from(commits)
      .where(eq(commits.gitHubId, 'sha-a'))
      .get()

    reconcileCommits(database, ['sha-a'], '2026-02-02T00:00:00.000Z')

    const rows = database
      .select()
      .from(commits)
      .where(eq(commits.gitHubId, 'sha-a'))
      .all()

    expect(rows.length).toEqual(1)
    expect(rows[0].id).toEqual(firstRow?.id)
    expect(rows[0].syncedAt).toEqual('2026-02-02T00:00:00.000Z')
  })

  it('soft-deletes live rows whose key is absent from the items', () => {
    reconcileCommits(database, ['sha-a', 'sha-b'], '2026-01-01T00:00:00.000Z')
    reconcileCommits(database, ['sha-a'], '2026-02-02T00:00:00.000Z')

    const removed = database
      .select()
      .from(commits)
      .where(eq(commits.gitHubId, 'sha-b'))
      .get()
    const kept = database
      .select()
      .from(commits)
      .where(eq(commits.gitHubId, 'sha-a'))
      .get()

    expect(removed?.deletedAt).toEqual('2026-02-02T00:00:00.000Z')
    expect(kept?.deletedAt).toEqual(null)
  })

  it('never soft-deletes rows guarded by protectFromDelete', () => {
    const buildPendingReview = (nodeId: string, now: string): NewReview => ({
      id: nodeId,
      gitHubId: nodeId,
      gitHubNumericId: 1,
      pullRequestId: 'PR_1',
      state: 'PENDING',
      body: null,
      bodyHtml: null,
      url: 'https://example.test',
      authorLogin: null,
      authorAvatarUrl: null,
      gitHubCreatedAt: null,
      gitHubSubmittedAt: null,
      syncedAt: now,
      deletedAt: null
    })

    const reconcilePendingReviews = (
      nodeIds: ReadonlyArray<string>,
      now: string
    ) =>
      reconcileBySoftDelete(database, reviews, {
        scope: [eq(reviews.pullRequestId, 'PR_1')],
        items: nodeIds,
        keyOfItem: (nodeId) => nodeId,
        keyOfRow: (row) => row.gitHubId,
        build: (nodeId) => buildPendingReview(nodeId, now),
        protectFromDelete: (row) => row.state === 'PENDING',
        now
      })

    reconcilePendingReviews(['review-pending'], '2026-01-01T00:00:00.000Z')

    // A later reconcile that no longer lists the pending review must not remove it.
    reconcilePendingReviews([], '2026-02-02T00:00:00.000Z')

    const review = database
      .select()
      .from(reviews)
      .where(eq(reviews.gitHubId, 'review-pending'))
      .get()

    expect(review?.deletedAt).toEqual(null)
  })
})
