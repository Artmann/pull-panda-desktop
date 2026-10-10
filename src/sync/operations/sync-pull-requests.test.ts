import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { NetworkError } from '../errors'
import type { PullRequestNode } from '../schemas/github-graphql'
import { Database } from '../services/database'
import { GitHubGraphQL } from '../services/github-graphql'
import { buildFingerprint, syncPullRequests } from './sync-pull-requests'

const timeOne = '2026-01-01T00:00:00Z'
const timeTwo = '2026-01-02T00:00:00Z'

const rateLimit = {
  cost: 1,
  limit: 5000,
  remaining: 4999,
  resetAt: timeOne
}

interface ProbeNode {
  headRefOid?: string
  id: string
  reviewDecision?: string | null
  updatedAt: string
}

interface KnownRow {
  fingerprint?: string | null
  id: string
  isAssignee?: boolean
  isAuthor?: boolean
  isReviewer?: boolean
  reviewDecision?: string | null
  updatedAt: string
}

const emptyFingerprint = 'none|none|none'

const knownRow = (row: KnownRow): Required<KnownRow> => ({
  fingerprint: null,
  isAssignee: false,
  isAuthor: false,
  isReviewer: false,
  reviewDecision: null,
  ...row
})

// A fake drizzle handle implementing only the fluent chains the operations
// under test invoke, recording writes so assertions can inspect them.
const makeStubDatabase = (knownRows: ReadonlyArray<KnownRow>) => {
  const inserts: Array<Record<string, unknown>> = []
  const updates: Array<Record<string, unknown>> = []

  const fakeDb = {
    insert: () => ({
      values: (record: Record<string, unknown>) => ({
        onConflictDoUpdate: () => ({
          run: () => {
            inserts.push(record)
          }
        })
      })
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          all: () => knownRows.map(knownRow)
        })
      })
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          run: () => {
            updates.push(values)
          }
        })
      })
    })
  }

  const layer = Layer.succeed(Database, {
    use: <A>(_operation: string, fn: (db: never) => A) =>
      Effect.sync(() => fn(fakeDb as never))
  })

  return { inserts, layer, updates }
}

interface StubGraphQLOptions {
  assigned?: ReadonlyArray<ProbeNode>
  authored?: ReadonlyArray<ProbeNode>
  authoredSecondPage?: ReadonlyArray<ProbeNode>
  hydrationFails?: boolean
  nodesById?: Record<string, PullRequestNode | null>
  reviewRequested?: ReadonlyArray<ProbeNode>
}

const probeBucket = (
  nodes: ReadonlyArray<ProbeNode>,
  endCursor: string | null = null
) => ({
  pageInfo: { hasNextPage: endCursor !== null, endCursor },
  nodes: nodes.map((node) => ({
    __typename: 'PullRequest',
    state: 'OPEN',
    ...node
  }))
})

const makeStubGraphQL = (options: StubGraphQLOptions) => {
  const hydrationCalls: string[][] = []
  const pageCalls: Array<Record<string, unknown>> = []

  const layer = Layer.succeed(GitHubGraphQL, {
    query: <A>(queryText: string, variables: Record<string, unknown>) => {
      if (queryText.includes('ProbePullRequestsPage')) {
        pageCalls.push(variables)

        return Effect.succeed({
          search: probeBucket(options.authoredSecondPage ?? []),
          rateLimit
        } as A)
      }

      if (queryText.includes('ProbePullRequests')) {
        return Effect.succeed({
          assigned: probeBucket(options.assigned ?? []),
          authored: probeBucket(
            options.authored ?? [],
            options.authoredSecondPage ? 'cursor-1' : null
          ),
          reviewRequested: probeBucket(options.reviewRequested ?? []),
          rateLimit
        } as A)
      }

      const ids = Object.values(variables) as string[]

      hydrationCalls.push(ids)

      if (options.hydrationFails === true) {
        return Effect.fail(
          new NetworkError({ route: 'graphql', cause: 'connection reset' })
        )
      }

      const response: Record<string, unknown> = { rateLimit }

      ids.forEach((id, index) => {
        response[`pr${index}`] = options.nodesById?.[id] ?? null
      })

      return Effect.succeed(response as A)
    }
  })

  return { hydrationCalls, layer, pageCalls }
}

const makePullRequestNode = (
  id: string,
  overrides: Partial<PullRequestNode> = {}
): PullRequestNode => ({
  __typename: 'PullRequest',
  id,
  number: 1,
  title: `Title ${id}`,
  body: 'Body',
  bodyHTML: '<p>Body</p>',
  headRefName: 'feature',
  baseRefName: 'main',
  state: 'OPEN',
  isDraft: false,
  url: 'https://github.com/octocat/demo/pull/1',
  createdAt: timeOne,
  updatedAt: timeOne,
  closedAt: null,
  mergedAt: null,
  repository: { name: 'demo', owner: { login: 'octocat' } },
  author: { login: 'octocat', avatarUrl: 'https://avatar.test/octocat' },
  labels: { nodes: [] },
  assignees: { nodes: [] },
  reviewRequests: { nodes: [] },
  ...overrides
})

const expectedPersistedRecord = (
  id: string,
  flags: { isAssignee: boolean; isAuthor: boolean; isReviewer: boolean },
  updatedAt: string
) => ({
  fingerprint: emptyFingerprint,
  id,
  number: 1,
  title: `Title ${id}`,
  body: 'Body',
  bodyHtml: '<p>Body</p>',
  headRefName: 'feature',
  baseRefName: 'main',
  state: 'OPEN',
  url: 'https://github.com/octocat/demo/pull/1',
  repositoryOwner: 'octocat',
  repositoryName: 'demo',
  authorLogin: 'octocat',
  authorAvatarUrl: 'https://avatar.test/octocat',
  createdAt: timeOne,
  updatedAt,
  closedAt: null as string | null,
  mergedAt: null as string | null,
  isDraft: false,
  isAuthor: flags.isAuthor,
  isAssignee: flags.isAssignee,
  isReviewer: flags.isReviewer,
  labels: '[]',
  assignees: '[]',
  requestedReviewers: '[]',
  reviewDecision: null as string | null,
  syncedAt: expect.any(String) as unknown
})

const runSync = (
  database: ReturnType<typeof makeStubDatabase>,
  graphql: ReturnType<typeof makeStubGraphQL>
) =>
  Effect.runPromise(
    Effect.provide(
      syncPullRequests,
      Layer.mergeAll(database.layer, graphql.layer)
    )
  )

describe('syncPullRequests', () => {
  it('hydrates and persists pull requests that are new locally, merging relation flags', async () => {
    const database = makeStubDatabase([])
    const graphql = makeStubGraphQL({
      authored: [
        { id: 'pr-1', updatedAt: timeOne },
        { id: 'pr-2', updatedAt: timeOne }
      ],
      assigned: [{ id: 'pr-2', updatedAt: timeOne }],
      nodesById: {
        'pr-1': makePullRequestNode('pr-1'),
        'pr-2': makePullRequestNode('pr-2')
      }
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 2,
      syncedIds: new Set(['pr-1', 'pr-2']),
      errors: [],
      hasChanges: true
    })
    expect(graphql.hydrationCalls).toEqual([['pr-1', 'pr-2']])
    expect(database.inserts).toEqual([
      expectedPersistedRecord(
        'pr-1',
        { isAuthor: true, isAssignee: false, isReviewer: false },
        timeOne
      ),
      expectedPersistedRecord(
        'pr-2',
        { isAuthor: true, isAssignee: true, isReviewer: false },
        timeOne
      )
    ])
    expect(database.updates).toEqual([])
  })

  it('refreshes changed relation flags without hydrating', async () => {
    const database = makeStubDatabase([
      { fingerprint: emptyFingerprint, id: 'pr-1', updatedAt: timeOne }
    ])
    const graphql = makeStubGraphQL({
      authored: [{ id: 'pr-1', updatedAt: timeOne }],
      reviewRequested: [{ id: 'pr-1', updatedAt: timeOne }]
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 0,
      syncedIds: new Set(['pr-1']),
      errors: [],
      hasChanges: true
    })
    expect(graphql.hydrationCalls).toEqual([])
    expect(database.inserts).toEqual([])
    expect(database.updates).toEqual([
      {
        fingerprint: emptyFingerprint,
        isAuthor: true,
        isAssignee: false,
        isReviewer: true,
        reviewDecision: null,
        syncedAt: expect.any(String) as unknown
      }
    ])
  })

  it('writes nothing when flags and fingerprint are unchanged', async () => {
    const database = makeStubDatabase([
      {
        fingerprint: emptyFingerprint,
        id: 'pr-1',
        isAuthor: true,
        updatedAt: timeOne
      }
    ])
    const graphql = makeStubGraphQL({
      authored: [{ id: 'pr-1', updatedAt: timeOne }]
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 0,
      syncedIds: new Set(['pr-1']),
      errors: [],
      hasChanges: false
    })
    expect(database.inserts).toEqual([])
    expect(database.updates).toEqual([])
  })

  it('stores a new fingerprint without reporting a list change', async () => {
    const database = makeStubDatabase([
      {
        fingerprint: emptyFingerprint,
        id: 'pr-1',
        isAuthor: true,
        updatedAt: timeOne
      }
    ])
    const graphql = makeStubGraphQL({
      authored: [{ headRefOid: 'abc123', id: 'pr-1', updatedAt: timeOne }]
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 0,
      syncedIds: new Set(['pr-1']),
      errors: [],
      hasChanges: false
    })
    expect(database.updates).toEqual([
      {
        fingerprint: 'abc123|none|none',
        isAuthor: true,
        isAssignee: false,
        isReviewer: false,
        reviewDecision: null,
        syncedAt: expect.any(String) as unknown
      }
    ])
  })

  it('stores a changed review decision and reports a list change', async () => {
    const database = makeStubDatabase([
      {
        fingerprint: 'none|none|APPROVED',
        id: 'pr-1',
        isAuthor: true,
        reviewDecision: 'APPROVED',
        updatedAt: timeOne
      }
    ])
    const graphql = makeStubGraphQL({
      authored: [
        { id: 'pr-1', reviewDecision: 'REVIEW_REQUIRED', updatedAt: timeOne }
      ]
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 0,
      syncedIds: new Set(['pr-1']),
      errors: [],
      hasChanges: true
    })
    expect(database.updates).toEqual([
      {
        fingerprint: 'none|none|REVIEW_REQUIRED',
        isAuthor: true,
        isAssignee: false,
        isReviewer: false,
        reviewDecision: 'REVIEW_REQUIRED',
        syncedAt: expect.any(String) as unknown
      }
    ])
  })

  it('backfills the review decision of a row stored before it was tracked', async () => {
    const database = makeStubDatabase([
      {
        fingerprint: 'none|none|REVIEW_REQUIRED',
        id: 'pr-1',
        isAuthor: true,
        updatedAt: timeOne
      }
    ])
    const graphql = makeStubGraphQL({
      authored: [
        { id: 'pr-1', reviewDecision: 'REVIEW_REQUIRED', updatedAt: timeOne }
      ]
    })

    const result = await runSync(database, graphql)

    expect(result.hasChanges).toEqual(true)
    expect(database.updates).toEqual([
      {
        fingerprint: 'none|none|REVIEW_REQUIRED',
        isAuthor: true,
        isAssignee: false,
        isReviewer: false,
        reviewDecision: 'REVIEW_REQUIRED',
        syncedAt: expect.any(String) as unknown
      }
    ])
  })

  it('reads further pages only for a search with more results', async () => {
    const database = makeStubDatabase([])
    const graphql = makeStubGraphQL({
      authored: [{ id: 'pr-1', updatedAt: timeOne }],
      authoredSecondPage: [{ id: 'pr-2', updatedAt: timeOne }],
      nodesById: {
        'pr-1': makePullRequestNode('pr-1'),
        'pr-2': makePullRequestNode('pr-2')
      }
    })

    const result = await runSync(database, graphql)

    expect(result.syncedIds).toEqual(new Set(['pr-1', 'pr-2']))
    expect(graphql.pageCalls).toEqual([
      { cursor: 'cursor-1', searchQuery: 'is:pr is:open author:@me' }
    ])
  })

  it('hydrates only changed pull requests and refreshes flags on unchanged ones', async () => {
    const database = makeStubDatabase([
      { id: 'pr-1', updatedAt: timeOne },
      { id: 'pr-2', updatedAt: timeOne }
    ])
    const graphql = makeStubGraphQL({
      authored: [{ id: 'pr-1', updatedAt: timeTwo }],
      assigned: [{ id: 'pr-2', updatedAt: timeOne }],
      nodesById: {
        'pr-1': makePullRequestNode('pr-1', { updatedAt: timeTwo })
      }
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 1,
      syncedIds: new Set(['pr-1', 'pr-2']),
      errors: [],
      hasChanges: true
    })
    expect(graphql.hydrationCalls).toEqual([['pr-1']])
    expect(database.inserts).toEqual([
      expectedPersistedRecord(
        'pr-1',
        { isAuthor: true, isAssignee: false, isReviewer: false },
        timeTwo
      )
    ])
    expect(database.updates).toEqual([
      {
        fingerprint: emptyFingerprint,
        isAuthor: false,
        isAssignee: true,
        isReviewer: false,
        reviewDecision: null,
        syncedAt: expect.any(String) as unknown
      }
    ])
  })

  it('collects an error and skips persistence when hydration fails', async () => {
    const database = makeStubDatabase([{ id: 'pr-1', updatedAt: timeOne }])
    const graphql = makeStubGraphQL({
      authored: [{ id: 'pr-1', updatedAt: timeTwo }],
      hydrationFails: true
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 0,
      syncedIds: new Set(['pr-1']),
      errors: [expect.stringContaining('Failed to hydrate PRs:') as unknown],
      hasChanges: true
    })
    expect(database.inserts).toEqual([])
    expect(database.updates).toEqual([])
  })

  it('skips entries the hydration response could not resolve', async () => {
    const database = makeStubDatabase([])
    const graphql = makeStubGraphQL({
      authored: [{ id: 'pr-1', updatedAt: timeOne }],
      nodesById: { 'pr-1': null }
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 0,
      syncedIds: new Set(['pr-1']),
      errors: [],
      hasChanges: true
    })
    expect(graphql.hydrationCalls).toEqual([['pr-1']])
    expect(database.inserts).toEqual([])
    expect(database.updates).toEqual([])
  })
})

describe('buildFingerprint', () => {
  it('combines the head commit, check rollup and review decision', () => {
    const fingerprint = buildFingerprint({
      __typename: 'PullRequest',
      commits: {
        nodes: [{ commit: { statusCheckRollup: { state: 'PENDING' } } }]
      },
      headRefOid: 'abc123',
      id: 'pr-1',
      reviewDecision: 'APPROVED',
      state: 'OPEN',
      updatedAt: timeOne
    })

    expect(fingerprint).toEqual('abc123|PENDING|APPROVED')
  })

  it('uses placeholders for missing fields', () => {
    const fingerprint = buildFingerprint({
      __typename: 'PullRequest',
      commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
      id: 'pr-1',
      reviewDecision: null,
      state: 'OPEN',
      updatedAt: timeOne
    })

    expect(fingerprint).toEqual('none|none|none')
  })
})
