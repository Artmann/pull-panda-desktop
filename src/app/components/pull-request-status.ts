import { PullRequest } from '@/types/pull-request'

export type PullRequestStatus =
  | 'Approved'
  | 'Changes Requested'
  | 'Closed'
  | 'Draft'
  | 'Merged'
  | 'Pending'

export function getPullRequestStatus(
  pullRequest: PullRequest
): PullRequestStatus {
  if (pullRequest.state === 'MERGED') {
    return 'Merged'
  }

  if (pullRequest.state === 'CLOSED') {
    return 'Closed'
  }

  if (pullRequest.changesRequestedCount > 0) {
    return 'Changes Requested'
  }

  if (pullRequest.approvalCount > 0) {
    return 'Approved'
  }

  if (pullRequest.isDraft) {
    return 'Draft'
  }

  return 'Pending'
}
