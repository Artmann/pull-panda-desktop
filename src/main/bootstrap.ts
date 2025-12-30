import { getDatabase } from '../database'
import { pullRequests } from '../database/schema'
import type {
  PullRequest,
  PullRequestLabel,
  PullRequestAssignee
} from '../types/pullRequest'

export interface BootstrapData {
  pullRequests: PullRequest[]
}

export async function bootstrap(): Promise<BootstrapData> {
  const database = getDatabase()

  const rows = database.select().from(pullRequests).all()

  const parsedPullRequests: PullRequest[] = rows.map((row) => ({
    assignees: row.assignees
      ? (JSON.parse(row.assignees) as PullRequestAssignee[])
      : [],
    authorAvatarUrl: row.authorAvatarUrl,
    authorLogin: row.authorLogin,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    id: row.id,
    isAssignee: row.isAssignee,
    isAuthor: row.isAuthor,
    isReviewer: row.isReviewer,
    labels: row.labels ? (JSON.parse(row.labels) as PullRequestLabel[]) : [],
    mergedAt: row.mergedAt,
    number: row.number,
    repositoryName: row.repositoryName,
    repositoryOwner: row.repositoryOwner,
    state: row.state as PullRequest['state'],
    syncedAt: row.syncedAt,
    title: row.title,
    updatedAt: row.updatedAt,
    url: row.url
  }))

  return {
    pullRequests: parsedPullRequests
  }
}
