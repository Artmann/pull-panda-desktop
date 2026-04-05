import { eq } from 'drizzle-orm'
import { log } from 'tiny-typescript-logger'

import { getDatabase } from '../database'
import { pullRequests, type NewPullRequest } from '../database/schema'
import { deletePullRequestData } from './delete-pull-request'
import { createGraphQLClient } from './graphql-client'

export interface SyncResult {
  synced: number
  syncedIds: Set<string>
  errors: string[]
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
}

interface SearchResult {
  nodes: GraphQLPullRequestNode[]
}

interface GraphQLSearchResponse {
  authored: SearchResult
  assigned: SearchResult
  reviewRequested: SearchResult
  rateLimit: {
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
}

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
    }))
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
    syncedAt: now
  }
}

const searchPullRequestsQuery = `
  query SearchPullRequests($authorQuery: String!, $assigneeQuery: String!, $reviewQuery: String!) {
    authored: search(query: $authorQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest {
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
        }
      }
    }
    assigned: search(query: $assigneeQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest {
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
        }
      }
    }
    reviewRequested: search(query: $reviewQuery, type: ISSUE, first: 100) {
      nodes {
        __typename
        ... on PullRequest {
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
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`

function filterPullRequestNodes(
  nodes: GraphQLPullRequestNode[]
): GitHubPullRequest[] {
  return nodes
    .filter((node) => node.__typename === 'PullRequest')
    .map(transformGraphQLNode)
}

export async function syncPullRequests(token: string): Promise<SyncResult> {
  const client = createGraphQLClient(token)
  const database = getDatabase()
  const errors: string[] = []
  const pullRequestMap = new Map<string, NewPullRequest>()

  try {
    const response = await client.query<GraphQLSearchResponse>(
      searchPullRequestsQuery,
      {
        authorQuery: 'is:pr is:open author:@me',
        assigneeQuery: 'is:pr is:open assignee:@me',
        reviewQuery: 'is:pr is:open review-requested:@me'
      }
    )

    // Process authored PRs
    const authored = filterPullRequestNodes(response.authored.nodes)

    for (const pullRequest of authored) {
      const existing = pullRequestMap.get(pullRequest.id)

      pullRequestMap.set(
        pullRequest.id,
        transformPullRequest(pullRequest, {
          isAuthor: true,
          isAssignee: existing?.isAssignee ?? false,
          isReviewer: existing?.isReviewer ?? false
        })
      )
    }

    log.info(`Fetched ${authored.length} authored PRs`)

    // Process assigned PRs
    const assigned = filterPullRequestNodes(response.assigned.nodes)

    for (const pullRequest of assigned) {
      const existing = pullRequestMap.get(pullRequest.id)

      pullRequestMap.set(
        pullRequest.id,
        transformPullRequest(pullRequest, {
          isAuthor: existing?.isAuthor ?? false,
          isAssignee: true,
          isReviewer: existing?.isReviewer ?? false
        })
      )
    }

    log.info(`Fetched ${assigned.length} assigned PRs`)

    // Process review-requested PRs
    const reviewRequested = filterPullRequestNodes(
      response.reviewRequested.nodes
    )

    for (const pullRequest of reviewRequested) {
      const existing = pullRequestMap.get(pullRequest.id)

      pullRequestMap.set(
        pullRequest.id,
        transformPullRequest(pullRequest, {
          isAuthor: existing?.isAuthor ?? false,
          isAssignee: existing?.isAssignee ?? false,
          isReviewer: true
        })
      )
    }

    log.info(`Fetched ${reviewRequested.length} review-requested PRs`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch PRs via GraphQL: ${message}`)
  }

  const pullRequestsToSync = Array.from(pullRequestMap.values())

  for (const pullRequest of pullRequestsToSync) {
    database
      .insert(pullRequests)
      .values(pullRequest)
      .onConflictDoUpdate({
        target: pullRequests.id,
        set: {
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
          isAuthor: pullRequest.isAuthor,
          isAssignee: pullRequest.isAssignee,
          isReviewer: pullRequest.isReviewer,
          labels: pullRequest.labels,
          assignees: pullRequest.assignees,
          syncedAt: pullRequest.syncedAt
        }
      })
      .run()
  }

  return {
    synced: pullRequestsToSync.length,
    syncedIds: new Set(pullRequestMap.keys()),
    errors
  }
}

const fetchPullRequestNodeQuery = `
  query FetchPullRequestNode($id: ID!) {
    node(id: $id) {
      ... on PullRequest {
        id
        number
        title
        body
        bodyHTML
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
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`

interface FetchPullRequestNodeResponse {
  node: GraphQLPullRequestNode | null
  rateLimit: {
    limit: number
    remaining: number
    resetAt: string
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

  for (const stalePullRequest of stalePullRequests) {
    try {
      const response = await client.query<FetchPullRequestNodeResponse>(
        fetchPullRequestNodeQuery,
        { id: stalePullRequest.id }
      )

      if (!response.node) {
        deletePullRequestData(stalePullRequest.id)
        deleted++
        continue
      }

      const now = new Date().toISOString()
      const node = response.node

      database
        .update(pullRequests)
        .set({
          state: node.state,
          closedAt: node.closedAt,
          mergedAt: node.mergedAt,
          updatedAt: node.updatedAt,
          syncedAt: now
        })
        .where(eq(pullRequests.id, stalePullRequest.id))
        .run()

      log.info(`Updated stale PR ${stalePullRequest.id} to state ${node.state}`)

      updated++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log.error(`Failed to fetch stale PR ${stalePullRequest.id}: ${message}`)
    }
  }

  if (deleted > 0) {
    log.info(`Deleted ${deleted} inaccessible PRs`)
  }

  return updated + deleted
}
