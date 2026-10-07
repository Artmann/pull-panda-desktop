import { Effect } from 'effect'
import { eq, inArray } from 'drizzle-orm'

import { pullRequests, type NewPullRequest } from '../../database/schema'
import {
  SyncHydrationFailedError,
  SyncProbeFailedError,
  type SyncError
} from '../errors'
import {
  CombinedProbeResponseSchema,
  MultiAliasResponseSchema,
  ProbePageResponseSchema,
  type ProbeBucket,
  type ProbeNode,
  type PullRequestNode
} from '../schemas/github-graphql'
import type { ProbeEntry, RelationFlags, SyncResult } from '../schemas/domain'
import { Database } from '../services/database'
import { GitHubGraphQL } from '../services/github-graphql'
import { deletePullRequestData } from './delete-pull-request'

const hydrationBatchSize = 25

const pullRequestNodeFields = `
  id
  number
  title
  body
  bodyHTML
  headRefName
  baseRefName
  state
  isDraft
  url
  createdAt
  updatedAt
  closedAt
  mergedAt
  repository {
    name
    owner { login }
  }
  author {
    login
    avatarUrl
  }
  labels(first: 50) {
    nodes { name color }
  }
  assignees(first: 50) {
    nodes { login avatarUrl }
  }
  reviewRequests(first: 20) {
    nodes {
      requestedReviewer {
        __typename
        ... on User { login avatarUrl }
        ... on Bot { login avatarUrl }
      }
    }
  }
`

// The probe reads just enough to notice a change: `updatedAt` moves on new
// commits, comments and reviews, and the fingerprint fields catch what it
// misses (checks finishing, the review decision changing). Keeping the nested
// selection to `commits(last: 1)` keeps each search at about 1 point.
const probeNodeSelection = `
  pageInfo { hasNextPage endCursor }
  nodes {
    __typename
    ... on PullRequest {
      id
      updatedAt
      state
      headRefOid
      reviewDecision
      commits(last: 1) {
        nodes { commit { statusCheckRollup { state } } }
      }
    }
  }
`

const searchQueries = {
  assigned: 'is:pr is:open assignee:@me',
  authored: 'is:pr is:open author:@me',
  reviewRequested: 'is:pr is:open review-requested:@me'
} as const

type ProbeBucketName = keyof typeof searchQueries

const relationForBucket: Record<ProbeBucketName, keyof RelationFlags> = {
  assigned: 'isAssignee',
  authored: 'isAuthor',
  reviewRequested: 'isReviewer'
}

// The first page of all three searches goes out as one request. Only a
// search with more than 100 results needs follow-up pages.
const combinedProbeQuery = `
  query ProbePullRequests($assignedQuery: String!, $authoredQuery: String!, $reviewRequestedQuery: String!) {
    assigned: search(query: $assignedQuery, type: ISSUE, first: 100) { ${probeNodeSelection} }
    authored: search(query: $authoredQuery, type: ISSUE, first: 100) { ${probeNodeSelection} }
    reviewRequested: search(query: $reviewRequestedQuery, type: ISSUE, first: 100) { ${probeNodeSelection} }
    rateLimit { cost limit remaining resetAt }
  }
`

// NB: the variable is named $searchQuery rather than $query because
// @octokit/graphql reserves the `query` key on its variables bag for the
// GraphQL document itself and rejects any caller that passes `query` as a
// variable name.
const probePageQuery = `
  query ProbePullRequestsPage($searchQuery: String!, $cursor: String) {
    search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) { ${probeNodeSelection} }
    rateLimit { cost limit remaining resetAt }
  }
`

export function buildFingerprint(node: ProbeNode): string {
  const rollupState =
    node.commits?.nodes[0]?.commit.statusCheckRollup?.state ?? 'none'

  return [
    node.headRefOid ?? 'none',
    rollupState,
    node.reviewDecision ?? 'none'
  ].join('|')
}

function buildMultiAliasQuery(idCount: number): string {
  const aliases = Array.from(
    { length: idCount },
    (_, index) =>
      `pr${index}: node(id: $id${index}) { ... on PullRequest { __typename ${pullRequestNodeFields} } }`
  )
  const variableSignatures = Array.from(
    { length: idCount },
    (_, index) => `$id${index}: ID!`
  ).join(', ')

  return `
    query HydratePullRequests(${variableSignatures}) {
      ${aliases.join('\n')}
      rateLimit { cost limit remaining resetAt }
    }
  `
}

function ingestProbeNodes(
  entries: Map<string, ProbeEntry>,
  nodes: ReadonlyArray<ProbeNode>,
  relation: keyof RelationFlags
): void {
  for (const node of nodes) {
    if (node.__typename !== 'PullRequest') {
      continue
    }

    const existing = entries.get(node.id)

    if (existing) {
      existing[relation] = true
      continue
    }

    entries.set(node.id, {
      fingerprint: buildFingerprint(node),
      id: node.id,
      updatedAt: node.updatedAt,
      isAuthor: relation === 'isAuthor',
      isAssignee: relation === 'isAssignee',
      isReviewer: relation === 'isReviewer'
    })
  }
}

const probeFailed = (cause: unknown) =>
  new SyncProbeFailedError({ cause }) as SyncError

// Reads the remaining pages of one search, starting after `cursor`.
const probeRemainingPages = (
  bucket: ProbeBucketName,
  startCursor: string | null,
  entries: Map<string, ProbeEntry>
): Effect.Effect<number, SyncError, GitHubGraphQL> =>
  Effect.gen(function* () {
    const graphql = yield* GitHubGraphQL
    let cursor = startCursor
    let totalCost = 0

    while (true) {
      const response = yield* graphql
        .query(
          probePageQuery,
          { searchQuery: searchQueries[bucket], cursor },
          ProbePageResponseSchema
        )
        .pipe(Effect.mapError(probeFailed))

      ingestProbeNodes(
        entries,
        response.search.nodes,
        relationForBucket[bucket]
      )
      totalCost += response.rateLimit.cost

      if (!response.search.pageInfo.hasNextPage) {
        break
      }

      cursor = response.search.pageInfo.endCursor
    }

    return totalCost
  })

function transformNode(
  node: PullRequestNode,
  entry: ProbeEntry,
  now: string
): NewPullRequest {
  return {
    fingerprint: entry.fingerprint,
    id: node.id,
    number: node.number,
    title: node.title,
    body: node.body,
    bodyHtml: node.bodyHTML,
    headRefName: node.headRefName,
    baseRefName: node.baseRefName,
    state: node.state,
    url: node.url,
    repositoryOwner: node.repository.owner.login,
    repositoryName: node.repository.name,
    authorLogin: node.author?.login ?? null,
    authorAvatarUrl: node.author?.avatarUrl ?? null,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    mergedAt: node.mergedAt,
    isDraft: node.isDraft,
    isAuthor: entry.isAuthor,
    isAssignee: entry.isAssignee,
    isReviewer: entry.isReviewer,
    labels: JSON.stringify(
      node.labels.nodes.map((label) => ({
        name: label.name,
        color: label.color
      }))
    ),
    assignees: JSON.stringify(
      node.assignees.nodes.map((assignee) => ({
        login: assignee.login,
        avatarUrl: assignee.avatarUrl
      }))
    ),
    requestedReviewers: JSON.stringify(
      node.reviewRequests.nodes.flatMap((entry) => {
        const reviewer = entry.requestedReviewer

        if (
          !reviewer ||
          (reviewer.__typename !== 'User' && reviewer.__typename !== 'Bot')
        ) {
          return []
        }

        const user = reviewer as { login: string; avatarUrl: string }

        return [{ login: user.login, avatarUrl: user.avatarUrl }]
      })
    ),
    syncedAt: now
  }
}

const persistPullRequest = (record: NewPullRequest) =>
  Effect.gen(function* () {
    const database = yield* Database

    yield* database.use('persistPullRequest', (db) => {
      db.insert(pullRequests)
        .values(record)
        .onConflictDoUpdate({
          target: pullRequests.id,
          set: {
            number: record.number,
            title: record.title,
            body: record.body,
            bodyHtml: record.bodyHtml,
            headRefName: record.headRefName,
            baseRefName: record.baseRefName,
            state: record.state,
            url: record.url,
            repositoryOwner: record.repositoryOwner,
            repositoryName: record.repositoryName,
            authorLogin: record.authorLogin,
            authorAvatarUrl: record.authorAvatarUrl,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            closedAt: record.closedAt,
            mergedAt: record.mergedAt,
            isDraft: record.isDraft,
            isAuthor: record.isAuthor,
            isAssignee: record.isAssignee,
            isReviewer: record.isReviewer,
            labels: record.labels,
            assignees: record.assignees,
            requestedReviewers: record.requestedReviewers,
            fingerprint: record.fingerprint,
            syncedAt: record.syncedAt
          }
        })
        .run()
    })
  })

interface KnownRow extends RelationFlags {
  fingerprint: string | null
  id: string
  updatedAt: string
}

const getKnownRows = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) {
      return new Map<string, KnownRow>()
    }

    const database = yield* Database

    const rows: KnownRow[] = yield* database.use('getKnownRows', (db) =>
      db
        .select({
          fingerprint: pullRequests.fingerprint,
          id: pullRequests.id,
          isAssignee: pullRequests.isAssignee,
          isAuthor: pullRequests.isAuthor,
          isReviewer: pullRequests.isReviewer,
          updatedAt: pullRequests.updatedAt
        })
        .from(pullRequests)
        .where(inArray(pullRequests.id, ids as string[]))
        .all()
    )

    return new Map(rows.map((row) => [row.id, row]))
  })

function haveRelationFlagsChanged(entry: ProbeEntry, known: KnownRow): boolean {
  return (
    entry.isAuthor !== known.isAuthor ||
    entry.isAssignee !== known.isAssignee ||
    entry.isReviewer !== known.isReviewer
  )
}

const updateProbeFields = (entry: ProbeEntry) =>
  Effect.gen(function* () {
    const database = yield* Database
    const now = new Date().toISOString()

    yield* database.use('updateProbeFields', (db) => {
      db.update(pullRequests)
        .set({
          fingerprint: entry.fingerprint,
          isAuthor: entry.isAuthor,
          isAssignee: entry.isAssignee,
          isReviewer: entry.isReviewer,
          syncedAt: now
        })
        .where(eq(pullRequests.id, entry.id))
        .run()
    })
  })

const hydratePullRequestNodes = (
  ids: ReadonlyArray<string>
): Effect.Effect<
  Map<string, PullRequestNode | null>,
  SyncError,
  GitHubGraphQL
> =>
  Effect.gen(function* () {
    const graphql = yield* GitHubGraphQL
    const result = new Map<string, PullRequestNode | null>()

    for (let offset = 0; offset < ids.length; offset += hydrationBatchSize) {
      const chunk = ids.slice(offset, offset + hydrationBatchSize)
      const query = buildMultiAliasQuery(chunk.length)
      const variables: Record<string, unknown> = {}

      for (let index = 0; index < chunk.length; index++) {
        variables[`id${index}`] = chunk[index]
      }

      const response = yield* graphql
        .query(query, variables, MultiAliasResponseSchema)
        .pipe(
          Effect.mapError(
            (cause) =>
              new SyncHydrationFailedError({ ids: chunk, cause }) as SyncError
          )
        )

      for (let index = 0; index < chunk.length; index++) {
        const alias = `pr${index}`
        const node = (response as Record<string, unknown>)[alias] as
          | PullRequestNode
          | null
          | undefined

        result.set(chunk[index], node ?? null)
      }
    }

    return result
  })

const probeAllRelations = (
  entries: Map<string, ProbeEntry>
): Effect.Effect<number, SyncError, GitHubGraphQL> =>
  Effect.gen(function* () {
    const graphql = yield* GitHubGraphQL

    const response = yield* graphql
      .query(
        combinedProbeQuery,
        {
          assignedQuery: searchQueries.assigned,
          authoredQuery: searchQueries.authored,
          reviewRequestedQuery: searchQueries.reviewRequested
        },
        CombinedProbeResponseSchema
      )
      .pipe(Effect.mapError(probeFailed))

    let totalCost = response.rateLimit.cost

    const buckets: ReadonlyArray<ProbeBucketName> = [
      'authored',
      'assigned',
      'reviewRequested'
    ]

    for (const bucket of buckets) {
      const firstPage: ProbeBucket = response[bucket]

      ingestProbeNodes(entries, firstPage.nodes, relationForBucket[bucket])

      if (firstPage.pageInfo.hasNextPage) {
        totalCost += yield* probeRemainingPages(
          bucket,
          firstPage.pageInfo.endCursor,
          entries
        )
      }
    }

    return totalCost
  })

function collectIdsNeedingHydration(
  entries: Map<string, ProbeEntry>,
  knownRows: ReadonlyMap<string, KnownRow>
): string[] {
  const ids: string[] = []

  for (const entry of entries.values()) {
    const known = knownRows.get(entry.id)

    if (!known || known.updatedAt !== entry.updatedAt) {
      ids.push(entry.id)
    }
  }

  return ids
}

const hydrateAndPersistPullRequests = (
  entries: Map<string, ProbeEntry>,
  ids: ReadonlyArray<string>,
  now: string
): Effect.Effect<
  { errors: ReadonlyArray<string>; syncedCount: number },
  SyncError,
  Database | GitHubGraphQL
> =>
  Effect.gen(function* () {
    const errors: string[] = []
    let syncedCount = 0

    const hydrated = yield* hydratePullRequestNodes(ids).pipe(
      Effect.catchTag('SyncHydrationFailedError', (error) => {
        errors.push(`Failed to hydrate PRs: ${String(error.cause)}`)

        return Effect.succeed(new Map<string, PullRequestNode | null>())
      })
    )

    for (const id of ids) {
      const node = hydrated.get(id)
      const entry = entries.get(id)

      if (!node || node.__typename !== 'PullRequest' || !entry) {
        continue
      }

      yield* persistPullRequest(transformNode(node, entry, now))
      syncedCount++
    }

    return { errors, syncedCount }
  })

// Writes the relation flags and fingerprint of pull requests that were not
// hydrated, but only for rows where one of them moved. The probe runs every
// few seconds, so skipping no-op writes keeps the database quiet. Returns
// whether any relation flag changed, since that changes the list.
const refreshUnchangedProbeFields = (
  entries: Map<string, ProbeEntry>,
  hydratedIds: ReadonlySet<string>,
  knownRows: ReadonlyMap<string, KnownRow>
) =>
  Effect.gen(function* () {
    let relationFlagsChanged = false

    for (const entry of entries.values()) {
      const known = knownRows.get(entry.id)

      if (hydratedIds.has(entry.id) || !known) {
        continue
      }

      const flagsChanged = haveRelationFlagsChanged(entry, known)

      if (!flagsChanged && entry.fingerprint === known.fingerprint) {
        continue
      }

      relationFlagsChanged = relationFlagsChanged || flagsChanged

      yield* updateProbeFields(entry)
    }

    return relationFlagsChanged
  })

export const syncPullRequests: Effect.Effect<
  SyncResult,
  SyncError,
  Database | GitHubGraphQL
> = Effect.gen(function* () {
  const now = new Date().toISOString()
  const entries = new Map<string, ProbeEntry>()

  const totalProbeCost = yield* probeAllRelations(entries)
  const allIds = Array.from(entries.keys())

  yield* Effect.logInfo(
    `[Sync] Probe returned ${allIds.length} PRs (cost=${totalProbeCost})`
  )

  const knownRows = yield* getKnownRows(allIds)
  const idsNeedingHydration = collectIdsNeedingHydration(entries, knownRows)
  const needsHydration = idsNeedingHydration.length > 0

  let errors: ReadonlyArray<string> = []
  let syncedCount = 0

  if (needsHydration) {
    yield* Effect.logInfo(
      `[Sync] Hydrating ${idsNeedingHydration.length}/${allIds.length} changed PRs`
    )

    const hydration = yield* hydrateAndPersistPullRequests(
      entries,
      idsNeedingHydration,
      now
    )

    errors = hydration.errors
    syncedCount = hydration.syncedCount
  }

  const relationFlagsChanged = yield* refreshUnchangedProbeFields(
    entries,
    new Set(idsNeedingHydration),
    knownRows
  )

  return {
    synced: syncedCount,
    syncedIds: new Set(entries.keys()),
    errors,
    hasChanges: needsHydration || relationFlagsChanged
  }
}).pipe(Effect.withSpan('sync.pullRequests'))

export const syncStalePullRequests = (
  syncedIds: ReadonlySet<string>
): Effect.Effect<number, SyncError, Database | GitHubGraphQL> =>
  Effect.gen(function* () {
    const database = yield* Database

    const localOpen = yield* database.use('syncStale.select', (db) =>
      db
        .select({ id: pullRequests.id })
        .from(pullRequests)
        .where(eq(pullRequests.state, 'OPEN'))
        .all()
    )

    const stale = localOpen
      .map((row) => row.id)
      .filter((id) => !syncedIds.has(id))

    if (stale.length === 0) {
      return 0
    }

    yield* Effect.logInfo(
      `Found ${stale.length} stale PRs still marked OPEN locally`
    )

    const hydrated = yield* hydratePullRequestNodes(stale)

    const now = new Date().toISOString()
    let deleted = 0
    let updated = 0

    for (const id of stale) {
      const node = hydrated.get(id)

      if (!node || node.__typename !== 'PullRequest') {
        yield* deletePullRequestData(id)
        deleted++
        continue
      }

      yield* database.use('syncStale.update', (db) => {
        db.update(pullRequests)
          .set({
            state: node.state,
            closedAt: node.closedAt,
            mergedAt: node.mergedAt,
            updatedAt: node.updatedAt,
            // A stale-but-still-open PR did not appear in any of the three
            // viewer-scoped search probes (author/assignee/review-requested),
            // so by definition the viewer is no longer in any of those
            // relations. Reset the flags so the PR drops out of those filters
            // instead of lingering with outdated relation state.
            isAuthor: false,
            isAssignee: false,
            isReviewer: false,
            syncedAt: now
          })
          .where(eq(pullRequests.id, id))
          .run()
      })

      updated++
    }

    if (deleted > 0) {
      yield* Effect.logInfo(`Deleted ${deleted} inaccessible PRs`)
    }

    return updated + deleted
  }).pipe(Effect.withSpan('sync.stalePullRequests'))
