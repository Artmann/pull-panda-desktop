import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { NetworkError } from '../errors'
import type { PullRequestNode } from '../schemas/github-graphql'
import { Database } from '../services/database'
import { GitHubGraphQL } from '../services/github-graphql'
import { syncPullRequests } from './sync-pull-requests'

const timeOne = '2026-01-01T00:00:00Z'
const timeTwo = '2026-01-02T00:00:00Z'

const rateLimit = {
  cost: 1,
  limit: 5000,
  remaining: 4999,
  resetAt: timeOne
}

interface ProbeNode {
  id: string
  updatedAt: string
}

interface KnownRow {
  id: string
  updatedAt: string
}

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
          all: () => knownRows
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
  hydrationFails?: boolean
  nodesById?: Record<string, PullRequestNode | null>
  reviewRequested?: ReadonlyArray<ProbeNode>
}

const probeResponse = (nodes: ReadonlyArray<ProbeNode>): unknown => ({
  search: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: nodes.map((node) => ({
      __typename: 'PullRequest',
      state: 'OPEN',
      ...node
    }))
  },
  rateLimit
})

const makeStubGraphQL = (options: StubGraphQLOptions) => {
  const hydrationCalls: string[][] = []

  const nodesForSearch = (searchQuery: string): ReadonlyArray<ProbeNode> => {
    if (searchQuery.includes('author:@me')) {
      return options.authored ?? []
    }

    if (searchQuery.includes('assignee:@me')) {
      return options.assigned ?? []
    }

    return options.reviewRequested ?? []
  }

  const layer = Layer.succeed(GitHubGraphQL, {
    query: <A>(queryText: string, variables: Record<string, unknown>) => {
      if (queryText.includes('ProbePullRequests')) {
        const searchQuery = variables.searchQuery as string

        return Effect.succeed(probeResponse(nodesForSearch(searchQuery)) as A)
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

  return { hydrationCalls, layer }
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
  id,
  number: 1,
  title: `Title ${id}`,
  body: 'Body',
  bodyHtml: '<p>Body</p>',
  headRefName: 'feature',
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

  it('refreshes relation flags without hydrating when nothing changed', async () => {
    const database = makeStubDatabase([{ id: 'pr-1', updatedAt: timeOne }])
    const graphql = makeStubGraphQL({
      authored: [{ id: 'pr-1', updatedAt: timeOne }],
      reviewRequested: [{ id: 'pr-1', updatedAt: timeOne }]
    })

    const result = await runSync(database, graphql)

    expect(result).toEqual({
      synced: 0,
      syncedIds: new Set(['pr-1']),
      errors: [],
      hasChanges: false
    })
    expect(graphql.hydrationCalls).toEqual([])
    expect(database.inserts).toEqual([])
    expect(database.updates).toEqual([
      {
        isAuthor: true,
        isAssignee: false,
        isReviewer: true,
        syncedAt: expect.any(String) as unknown
      }
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
        isAuthor: false,
        isAssignee: true,
        isReviewer: false,
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
