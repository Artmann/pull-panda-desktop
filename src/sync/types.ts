export interface GitHubPullRequest {
  id: string
  number: number
  title: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  mergedAt: string | null
  author: {
    login: string
    avatarUrl: string
  } | null
  repository: {
    owner: {
      login: string
    }
    name: string
  }
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

export interface PullRequestSearchResult {
  search: {
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
    nodes: Array<GitHubPullRequest | null>
  }
}
