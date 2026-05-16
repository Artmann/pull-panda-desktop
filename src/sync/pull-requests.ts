import { eq, inArray } from 'drizzle-orm'
import { log } from 'tiny-typescript-logger'

import { getDatabase } from '../database'
import { pullRequests, type NewPullRequest } from '../database/schema'
import { deletePullRequestData } from './delete-pull-request'
import { createGraphQLClient, type GraphQLClient } from './graphql-client'

export interface SyncResult {
  synced: number
  syncedIds: Set<string>
  errors: string[]
  hasChanges: boolean
}

interface RelationFlags {
  isAuthor: boolean
  isAssignee: boolean
  isReviewer: boolean
}

interface GraphQLPullRequestNode {
  __typename: string
  id: string
  number: number
  title: string
  body: string | null
  bodyHTML: string
  headRefName: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  mergedAt: string | null
  repository: {
    name: string
    owner: {
      login: string
    }
  }
  author: {
    login: string
    avatarUrl: string
  } | null
  labels: {
    nodes: Array<{
      name: string
      color: string
    }>
  }
  assignees: {
    nodes: Array<{
      login: string
      avatarUrl: string
    }>
  }
  reviewRequests: {
    nodes: Array<{
      requestedReviewer:
        | {
            __typename: 'User' | 'Bot'
            login: string
            avatarUrl: string
          }
        | {
            __typename: string
          }
        | null
    }>
  }
}

interface ProbeNode {
  __typename: string
  id: string
  updatedAt: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
}

interface ProbeBucket {
  nodes: ProbeNode[]
}

interface ProbeResponse {
  authored: ProbeBucket
  assigned: ProbeBucket
  reviewRequested: ProbeBucket
  rateLimit: {
    cost: number
    limit: number
    remaining: number
    resetAt: string
  }
}

interface GitHubPullRequest {
  id: string
  number: number
  title: string
  body: string | null
  bodyHtml: string | null
  headRefName: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  url: string
  repositoryOwner: string
  repositoryName: string
  authorLogin: string | null
  authorAvatarUrl: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  mergedAt: string | null
  isDraft: boolean
  labels: Array<{ name: string; color: string }>
  assignees: Array<{ login: string; avatarUrl: string }>
  requestedReviewers: Array<{ login: string; avatarUrl: string }>
}

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
    owner {
      login
    }
  }
  author {
    login
    avatarUrl
  }
  labels(first: 10) {
    nodes {
      name
      color
    }
  }
  assignees(first: 10) {
    nodes {
      login
      avatarUrl
    }
  }
  reviewRequests(first: 20) {
    nodes {
      requestedReviewer {
        __typename
        ... on User {
          login
          avatarUrl
        }
        ... on Bot {
          login
          avatarUrl
        }
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
        ... on PullRequest {
          id
          updatedAt
          state
        }
      }
    }
    assigned: search(query: $assigneeQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest {
          id
          updatedAt
          state
        }
      }
    }
    reviewRequested: search(query: $reviewQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest {
          id
          updatedAt
          state
        }
      }
    }
    rateLimit {
      cost
      limit
      remaining
      resetAt
    }
  }
`

function transformGraphQLNode(node: GraphQLPullRequestNode): GitHubPullRequest {
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
    labels: node.labels.nodes.map((label) => ({
      name: label.name,
      color: label.color
    })),
    assignees: node.assignees.nodes.map((assignee) => ({
      login: assignee.login,
      avatarUrl: assignee.avatarUrl
    })),
    requestedReviewers: node.reviewRequests.nodes.flatMap((entry) => {
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
  }
}

function transformPullRequest(
  pullRequest: GitHubPullRequest,
  relation: RelationFlags
): NewPullRequest {
  const now = new Date().toISOString()

  return {
    id: pullRequest.id,
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body,
    bodyHtml: pullRequest.bodyHtml,
    headRefName: pullRequest.headRefName,
    state: pullRequest.state,
    url: pullRequest.url,
    repositoryOwner: pullRequest.repositoryOwner,
    repositoryName: pullRequest.repositoryName,
    authorLogin: pullRequest.authorLogin,
    authorAvatarUrl: pullRequest.authorAvatarUrl,
    createdAt: pullRequest.createdAt,
    updatedAt: pullRequest.updatedAt,
    closedAt: pullRequest.closedAt,
    mergedAt: pullRequest.mergedAt,
    isDraft: pullRequest.isDraft,
    isAuthor: relation.isAuthor,
    isAssignee: relation.isAssignee,
    isReviewer: relation.isReviewer,
    labels: JSON.stringify(pullRequest.labels),
    assignees: JSON.stringify(pullRequest.assignees),
    requestedReviewers: JSON.stringify(pullRequest.requestedReviewers),
    syncedAt: now
  }
}

function buildMultiAliasQuery(idCount: number): string {
  const aliases = Array.from({ length: idCount }, (_, index) => {
    return `pr${index}: node(id: $id${index}) { ... on PullRequest { __typename ${pullRequestNodeFields} } }`
  })
  const variables = Array.from(
    { length: idCount },
    (_, index) => `$id${index}: ID!`
  ).join(', ')

  return `
    query HydratePullRequests(${variables}) {
      ${aliases.join('\n')}
      rateLimit { cost limit remaining resetAt }
    }
  `
}

interface MultiAliasResponse {
  rateLimit: { cost: number; limit: number; remaining: number; resetAt: string }
  [alias: string]: GraphQLPullRequestNode | null | MultiAliasResponse['rateLimit']
}

/**
 * Fetch up to `hydrationBatchSize` PR nodes by id in a single GraphQL request.
 * Returns a map from id to node (or `null` if the PR is no longer accessible).
 */
async function hydratePullRequestNodes(
  client: GraphQLClient,
  ids: string[]
): Promise<Map<string, GraphQLPullRequestNode | null>> {
  const result = new Map<string, GraphQLPullRequestNode | null>()

  for (let offset = 0; offset < ids.length; offset += hydrationBatchSize) {
    const chunk = ids.slice(offset, offset + hydrationBatchSize)
    const query = buildMultiAliasQuery(chunk.length)
    const variables: Record<string, unknown> = {}

    for (let index = 0; index < chunk.length; index++) {
      variables[`id${index}`] = chunk[index]
    }

    const response = await client.query<MultiAliasResponse>(query, variables)

    for (let index = 0; index < chunk.length; index++) {
      const alias = `pr${index}`
      const node = response[alias] as GraphQLPullRequestNode | null

      result.set(chunk[index], node ?? null)
    }
  }

  return result
}

interface ProbeEntry {
  id: string
  updatedAt: string
  isAuthor: boolean
  isAssignee: boolean
  isReviewer: boolean
}

function collectProbeEntries(response: ProbeResponse): Map<string, ProbeEntry> {
  const entries = new Map<string, ProbeEntry>()

  const ingest = (
    nodes: ProbeNode[],
    relation: keyof Omit<ProbeEntry, 'id' | 'updatedAt'>
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

function getKnownUpdatedAtMap(ids: string[]): Map<string, string> {
  if (ids.length === 0) {
    return new Map()
  }

  const database = getDatabase()
  const rows = database
    .select({ id: pullRequests.id, updatedAt: pullRequests.updatedAt })
    .from(pullRequests)
    .where(inArray(pullRequests.id, ids))
    .all()

  return new Map(rows.map((row) => [row.id, row.updatedAt]))
}

function updateRelationFlags(entry: ProbeEntry): void {
  const database = getDatabase()
  const now = new Date().toISOString()

  database
    .update(pullRequests)
    .set({
      isAuthor: entry.isAuthor,
      isAssignee: entry.isAssignee,
      isReviewer: entry.isReviewer,
      syncedAt: now
    })
    .where(eq(pullRequests.id, entry.id))
    .run()
}

function persistPullRequest(record: NewPullRequest): void {
  const database = getDatabase()

  database
    .insert(pullRequests)
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
}

export async function syncPullRequests(token: string): Promise<SyncResult> {
  const client = createGraphQLClient(token)
  const errors: string[] = []
  let syncedCount = 0
  let hasChanges = false

  let probe: ProbeResponse

  try {
    probe = await client.query<ProbeResponse>(probeQuery, {
      authorQuery: 'is:pr is:open author:@me',
      assigneeQuery: 'is:pr is:open assignee:@me',
      reviewQuery: 'is:pr is:open review-requested:@me'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return {
      synced: 0,
      syncedIds: new Set(),
      errors: [`Failed to probe PRs via GraphQL: ${message}`],
      hasChanges: false
    }
  }

  const entries = collectProbeEntries(probe)
  const allIds = Array.from(entries.keys())

  log.info(
    `[Sync] Probe returned ${allIds.length} PRs (cost=${probe.rateLimit.cost})`
  )

  const knownUpdatedAt = getKnownUpdatedAtMap(allIds)
  const idsNeedingHydration: string[] = []

  for (const entry of entries.values()) {
    const known = knownUpdatedAt.get(entry.id)

    if (!known || known !== entry.updatedAt) {
      idsNeedingHydration.push(entry.id)
    }
  }

  hasChanges = idsNeedingHydration.length > 0

  if (idsNeedingHydration.length > 0) {
    log.info(
      `[Sync] Hydrating ${idsNeedingHydration.length}/${allIds.length} changed PRs`
    )

    try {
      const hydrated = await hydratePullRequestNodes(client, idsNeedingHydration)

      for (const id of idsNeedingHydration) {
        const node = hydrated.get(id)

        if (!node || node.__typename !== 'PullRequest') {
          continue
        }

        const entry = entries.get(id)

        if (!entry) {
          continue
        }

        const transformed = transformGraphQLNode(node)
        const record = transformPullRequest(transformed, {
          isAuthor: entry.isAuthor,
          isAssignee: entry.isAssignee,
          isReviewer: entry.isReviewer
        })

        persistPullRequest(record)
        syncedCount++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      errors.push(`Failed to hydrate PRs: ${message}`)
    }
  }

  // Re-assert relation flags for unchanged PRs so assignment-only changes still
  // propagate. The cost is local DB writes only.
  for (const entry of entries.values()) {
    if (idsNeedingHydration.includes(entry.id)) {
      continue
    }

    if (knownUpdatedAt.has(entry.id)) {
      updateRelationFlags(entry)
    }
  }

  return {
    synced: syncedCount,
    syncedIds: new Set(entries.keys()),
    errors,
    hasChanges
  }
}

export async function syncStalePullRequests(
  token: string,
  syncedIds: Set<string>
): Promise<number> {
  const client = createGraphQLClient(token)
  const database = getDatabase()

  const localOpenPullRequests = database
    .select({ id: pullRequests.id })
    .from(pullRequests)
    .where(eq(pullRequests.state, 'OPEN'))
    .all()

  const stalePullRequests = localOpenPullRequests.filter(
    (pullRequest) => !syncedIds.has(pullRequest.id)
  )

  if (stalePullRequests.length === 0) {
    return 0
  }

  log.info(
    `Found ${stalePullRequests.length} stale PRs still marked OPEN locally`
  )

  let deleted = 0
  let updated = 0

  try {
    const ids = stalePullRequests.map((pullRequest) => pullRequest.id)
    const hydrated = await hydratePullRequestNodes(client, ids)
    const now = new Date().toISOString()

    for (const id of ids) {
      const node = hydrated.get(id)

      if (!node || node.__typename !== 'PullRequest') {
        deletePullRequestData(id)
        deleted++

        continue
      }

      database
        .update(pullRequests)
        .set({
          state: node.state,
          closedAt: node.closedAt,
          mergedAt: node.mergedAt,
          updatedAt: node.updatedAt,
          syncedAt: now
        })
        .where(eq(pullRequests.id, id))
        .run()

      log.info(`Updated stale PR ${id} to state ${node.state}`)
      updated++
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    log.error(`Failed to hydrate stale PRs: ${message}`)
  }

  if (deleted > 0) {
    log.info(`Deleted ${deleted} inaccessible PRs`)
  }

  return updated + deleted
}
