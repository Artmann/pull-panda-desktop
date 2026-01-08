import { getDatabase } from '../database'
import { pullRequests, type NewPullRequest } from '../database/schema'
import { createRestClient } from './restClient'
import { etagManager } from './etagManager'

export interface SyncResult {
  synced: number
  errors: string[]
}

interface RelationFlags {
  isAuthor: boolean
  isAssignee: boolean
  isReviewer: boolean
}

interface SearchResultItem {
  id: number
  node_id: string
  number: number
  title: string
  body: string | null
  body_html?: string
  state: string
  html_url: string
  created_at: string
  updated_at: string
  closed_at: string | null
  draft: boolean
  user: {
    login: string
    avatar_url: string
  } | null
  labels: Array<{
    name: string
    color: string
  }>
  assignees: Array<{
    login: string
    avatar_url: string
  }>
  pull_request?: {
    url: string
    html_url: string
    merged_at: string | null
  }
  repository_url: string
}

interface SearchResponse {
  total_count: number
  incomplete_results: boolean
  items: SearchResultItem[]
}

interface GitHubPullRequest {
  id: string
  number: number
  title: string
  body: string | null
  bodyHtml: string | null
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

function parseRepositoryFromUrl(repoUrl: string): { owner: string; name: string } {
  // URL format: https://api.github.com/repos/{owner}/{name}
  const parts = repoUrl.split('/')
  const name = parts.pop() ?? ''
  const owner = parts.pop() ?? ''

  return { owner, name }
}

function transformSearchItem(item: SearchResultItem): GitHubPullRequest {
  const repo = parseRepositoryFromUrl(item.repository_url)
  const mergedAt = item.pull_request?.merged_at ?? null

  let state: 'OPEN' | 'CLOSED' | 'MERGED' = 'OPEN'

  if (mergedAt) {
    state = 'MERGED'
  } else if (item.state === 'closed') {
    state = 'CLOSED'
  }

  return {
    id: item.node_id,
    number: item.number,
    title: item.title,
    body: item.body,
    bodyHtml: item.body_html ?? null,
    state,
    url: item.html_url,
    repositoryOwner: repo.owner,
    repositoryName: repo.name,
    authorLogin: item.user?.login ?? null,
    authorAvatarUrl: item.user?.avatar_url ?? null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    closedAt: item.closed_at,
    mergedAt,
    isDraft: item.draft,
    labels: item.labels.map((label) => ({ name: label.name, color: label.color })),
    assignees: item.assignees.map((assignee) => ({
      login: assignee.login,
      avatarUrl: assignee.avatar_url
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

async function fetchPullRequestsByQuery(
  client: ReturnType<typeof createRestClient>,
  query: string,
  etagKey: { endpointType: string; resourceId: string }
): Promise<{ items: GitHubPullRequest[]; notModified: boolean; etag: string | null }> {
  const cached = etagManager.get(etagKey)

  const result = await client.request<SearchResponse>(
    'GET /search/issues',
    {
      q: query,
      per_page: 100,
      sort: 'updated',
      order: 'desc'
    },
    { etag: cached?.etag ?? undefined }
  )

  if (result.notModified) {
    return { items: [], notModified: true, etag: cached?.etag ?? null }
  }

  const items = (result.data?.items ?? [])
    .filter((item) => item.pull_request) // Only PRs, not issues
    .map(transformSearchItem)

  return { items, notModified: false, etag: result.etag }
}

export async function syncPullRequests(token: string): Promise<SyncResult> {
  const client = createRestClient(token)
  const database = getDatabase()
  const errors: string[] = []
  const pullRequestMap = new Map<string, NewPullRequest>()

  // Fetch authored PRs
  try {
    const authoredEtagKey = { endpointType: 'pull_requests', resourceId: 'authored' }
    const { items: authored, notModified, etag } = await fetchPullRequestsByQuery(
      client,
      'is:pr is:open author:@me',
      authoredEtagKey
    )

    if (!notModified) {
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

      if (etag) {
        etagManager.set(authoredEtagKey, etag)
      }

      console.log(`Fetched ${authored.length} authored PRs`)
    } else {
      console.log('[authored PRs] No changes (304)')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch authored PRs: ${message}`)
  }

  // Fetch assigned PRs
  try {
    const assignedEtagKey = { endpointType: 'pull_requests', resourceId: 'assigned' }
    const { items: assigned, notModified, etag } = await fetchPullRequestsByQuery(
      client,
      'is:pr is:open assignee:@me',
      assignedEtagKey
    )

    if (!notModified) {
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

      if (etag) {
        etagManager.set(assignedEtagKey, etag)
      }

      console.log(`Fetched ${assigned.length} assigned PRs`)
    } else {
      console.log('[assigned PRs] No changes (304)')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch assigned PRs: ${message}`)
  }

  // Fetch review-requested PRs
  try {
    const reviewEtagKey = { endpointType: 'pull_requests', resourceId: 'review_requested' }
    const { items: reviewRequested, notModified, etag } = await fetchPullRequestsByQuery(
      client,
      'is:pr is:open review-requested:@me',
      reviewEtagKey
    )

    if (!notModified) {
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

      if (etag) {
        etagManager.set(reviewEtagKey, etag)
      }

      console.log(`Fetched ${reviewRequested.length} review-requested PRs`)
    } else {
      console.log('[review-requested PRs] No changes (304)')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to fetch review-requested PRs: ${message}`)
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
    errors
  }
}
