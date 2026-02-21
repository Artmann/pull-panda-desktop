export interface PullRequestLabel {
  name: string
  color: string
}

export interface PullRequestAssignee {
  login: string
  avatarUrl: string
}

export interface PullRequest {
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
  isAuthor: boolean
  isAssignee: boolean
  isReviewer: boolean
  labels: PullRequestLabel[]
  assignees: PullRequestAssignee[]
  syncedAt: string
  detailsSyncedAt: string | null
  commentCount: number
  approvalCount: number
  changesRequestedCount: number
}

export type PullRequestRelation = 'author' | 'assignee' | 'reviewer'
