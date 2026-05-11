import { Effect, Schema } from 'effect'
import { eq, inArray } from 'drizzle-orm'

import {
  pullRequests,
  type NewPullRequest
} from '../../database/schema'
import {
  SyncHydrationFailedError,
  SyncProbeFailedError,
  type SyncError
} from '../errors'
import {
  MultiAliasResponseSchema,
  ProbeResponseSchema,
  type PullRequestNode
} from '../schemas/github-graphql'
import type {
  ProbeEntry,
  RelationFlags,
  SyncResult
} from '../schemas/domain'
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
  labels(first: 10) {
    nodes { name color }
  }
  assignees(first: 10) {
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

const probeQuery = `
  query ProbePullRequests(
    $authorQuery: String!
    $assigneeQuery: String!
    $reviewQuery: String!
  ) {
    authored: search(query: $authorQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest { id updatedAt state }
      }
    }
    assigned: search(query: $assigneeQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest { id updatedAt state }
      }
    }
    reviewRequested: search(query: $reviewQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest { id updatedAt state }
      }
    }
    rateLimit { cost limit remaining resetAt }
  }
`

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

function collectProbeEntries(
  response: Schema.Schema.Type<typeof ProbeResponseSchema>
): Map<string, ProbeEntry> {
  const entries = new Map<string, ProbeEntry>()

  const ingest = (
    nodes: ReadonlyArray<{
      __typename: string
      id: string
      updatedAt: string
    }>,
    relation: keyof RelationFlags
  ): void => {
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
        id: node.id,
        updatedAt: node.updatedAt,
        isAuthor: relation === 'isAuthor',
        isAssignee: relation === 'isAssignee',
        isReviewer: relation === 'isReviewer'
      })
    }
  }

  ingest(response.authored.nodes, 'isAuthor')
  ingest(response.assigned.nodes, 'isAssignee')
  ingest(response.reviewRequested.nodes, 'isReviewer')

  return entries
}

function transformNode(
  node: PullRequestNode,
  relation: RelationFlags,
  now: string
): NewPullRequest {
  return {
    id: node.id,
    number: node.number,
    title: node.title,
    body: node.body,
    bodyHtml: node.bodyHTML,
    headRefName: node.headRefName,
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
    isAuthor: relation.isAuthor,
    isAssignee: relation.isAssignee,
    isReviewer: relation.isReviewer,
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
            syncedAt: record.syncedAt
          }
        })
        .run()
    })
  })

const getKnownUpdatedAtMap = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) {
      return new Map<string, string>()
    }

    const database = yield* Database

    const rows = yield* database.use('getKnownUpdatedAt', (db) =>
      db
        .select({ id: pullRequests.id, updatedAt: pullRequests.updatedAt })
        .from(pullRequests)
        .where(inArray(pullRequests.id, ids as string[]))
        .all()
    )

    return new Map(rows.map((row) => [row.id, row.updatedAt]))
  })

const updateRelationFlags = (entry: ProbeEntry) =>
  Effect.gen(function* () {
    const database = yield* Database
    const now = new Date().toISOString()

    yield* database.use('updateRelationFlags', (db) => {
      db.update(pullRequests)
        .set({
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

export const syncPullRequests: Effect.Effect<
  SyncResult,
  SyncError,
  Database | GitHubGraphQL
> = Effect.gen(function* () {
  const graphql = yield* GitHubGraphQL
  const now = new Date().toISOString()

  const probe = yield* graphql
    .query(
      probeQuery,
      {
        authorQuery: 'is:pr is:open author:@me',
        assigneeQuery: 'is:pr is:open assignee:@me',
        reviewQuery: 'is:pr is:open review-requested:@me'
      },
      ProbeResponseSchema
    )
    .pipe(
      Effect.mapError(
        (cause) => new SyncProbeFailedError({ cause }) as SyncError
      )
    )

  const entries = collectProbeEntries(probe)
  const allIds = Array.from(entries.keys())

  yield* Effect.logInfo(
    `[Sync] Probe returned ${allIds.length} PRs (cost=${probe.rateLimit.cost})`
  )

  const knownUpdatedAt = yield* getKnownUpdatedAtMap(allIds)
  const idsNeedingHydration: string[] = []

  for (const entry of entries.values()) {
    const known = knownUpdatedAt.get(entry.id)

    if (!known || known !== entry.updatedAt) {
      idsNeedingHydration.push(entry.id)
    }
  }

  const hasChanges = idsNeedingHydration.length > 0
  let syncedCount = 0
  const errors: string[] = []

  if (hasChanges) {
    yield* Effect.logInfo(
      `[Sync] Hydrating ${idsNeedingHydration.length}/${allIds.length} changed PRs`
    )

    const hydrated = yield* hydratePullRequestNodes(idsNeedingHydration).pipe(
      Effect.catchTag('SyncHydrationFailedError', (error) => {
        errors.push(`Failed to hydrate PRs: ${String(error.cause)}`)
        return Effect.succeed(new Map<string, PullRequestNode | null>())
      })
    )

    for (const id of idsNeedingHydration) {
      const node = hydrated.get(id)

      if (!node || node.__typename !== 'PullRequest') {
        continue
      }

      const entry = entries.get(id)

      if (!entry) {
        continue
      }

      const record = transformNode(node, entry, now)

      yield* persistPullRequest(record)
      syncedCount++
    }
  }

  for (const entry of entries.values()) {
    if (idsNeedingHydration.includes(entry.id)) {
      continue
    }

    if (knownUpdatedAt.has(entry.id)) {
      yield* updateRelationFlags(entry)
    }
  }

  return {
    synced: syncedCount,
    syncedIds: new Set(entries.keys()),
    errors,
    hasChanges
  }
})

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

    const hydrated = yield* hydratePullRequestNodes(stale).pipe(
      Effect.catchTag('SyncHydrationFailedError', () =>
        Effect.succeed(new Map<string, PullRequestNode | null>())
      )
    )

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
  })
