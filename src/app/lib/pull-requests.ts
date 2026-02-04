import type { PullRequest } from '@/types/pull-request'

export function filterReadyPullRequests(
  pullRequests?: PullRequest[] | null
): PullRequest[] {
  if (!pullRequests) {
    return []
  }

  return pullRequests.filter((pullRequest) =>
    Boolean(pullRequest.detailsSyncedAt)
  )
}
