import type { QueryClient } from '@tanstack/react-query'

import type { PullRequest } from '@/types/pull-request'
import type {
  Check,
  Comment,
  CommentReaction,
  Commit,
  ModifiedFile,
  Review
} from '@/types/pull-request-details'

import type { PendingReview } from './queries/use-pending-review'
import { queryKeys } from './query-keys'

interface BootstrapData {
  checks: Check[]
  comments: Comment[]
  commits: Commit[]
  modifiedFiles: ModifiedFile[]
  pendingReviews: Record<string, PendingReview>
  pullRequests: PullRequest[]
  reactions: CommentReaction[]
  reviews: Review[]
}

export function seedQueryCache(
  queryClient: QueryClient,
  data: BootstrapData
): void {
  queryClient.setQueryData(queryKeys.pullRequests.all, data.pullRequests)

  // Group detail data by pullRequestId
  const checksMap = groupBy(data.checks, (c) => c.pullRequestId)
  const commentsMap = groupBy(data.comments, (c) => c.pullRequestId)
  const commitsMap = groupBy(data.commits, (c) => c.pullRequestId)
  const filesMap = groupBy(data.modifiedFiles, (f) => f.pullRequestId)
  const reactionsMap = groupBy(data.reactions, (r) => r.pullRequestId)
  const reviewsMap = groupBy(data.reviews, (r) => r.pullRequestId)

  // Collect all pullRequestIds from all detail data
  const allIds = new Set<string>()

  for (const id of checksMap.keys()) allIds.add(id)
  for (const id of commentsMap.keys()) allIds.add(id)
  for (const id of commitsMap.keys()) allIds.add(id)
  for (const id of filesMap.keys()) allIds.add(id)
  for (const id of reactionsMap.keys()) allIds.add(id)
  for (const id of reviewsMap.keys()) allIds.add(id)

  for (const [pullRequestId, review] of Object.entries(data.pendingReviews)) {
    allIds.add(pullRequestId)

    if (review) {
      queryClient.setQueryData(
        queryKeys.pendingReviews.byPullRequest(pullRequestId),
        review
      )
    }
  }

  for (const id of allIds) {
    const checks = checksMap.get(id)
    const comments = commentsMap.get(id)
    const commits = commitsMap.get(id)
    const files = filesMap.get(id)
    const reactions = reactionsMap.get(id)
    const reviews = reviewsMap.get(id)

    if (checks) {
      queryClient.setQueryData(queryKeys.checks.byPullRequest(id), checks)
    }

    if (comments) {
      queryClient.setQueryData(queryKeys.comments.byPullRequest(id), comments)
    }

    if (commits) {
      queryClient.setQueryData(queryKeys.commits.byPullRequest(id), commits)
    }

    if (files) {
      queryClient.setQueryData(queryKeys.modifiedFiles.byPullRequest(id), files)
    }

    if (reactions) {
      queryClient.setQueryData(queryKeys.reactions.byPullRequest(id), reactions)
    }

    if (reviews) {
      queryClient.setQueryData(queryKeys.reviews.byPullRequest(id), reviews)
    }
  }
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()

  for (const item of items) {
    const key = keyFn(item)
    const group = map.get(key)

    if (group) {
      group.push(item)
    } else {
      map.set(key, [item])
    }
  }

  return map
}
