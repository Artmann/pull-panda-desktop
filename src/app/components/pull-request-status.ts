import { PullRequest } from '@/types/pull-request'

export type PullRequestStatus =
  | 'Approved'
  | 'Changes Requested'
  | 'Closed'
  | 'Draft'
  | 'Merged'
  | 'Pending'

export type ReviewOutcome = 'approved' | 'changes-requested' | 'pending'

type ReviewedPullRequest = Pick<
  PullRequest,
  'approvalCount' | 'changesRequestedCount' | 'reviewDecision'
>

/**
 * Whether the reviews let the pull request merge. GitHub's review decision
 * accounts for code owners, the required approval count and who is allowed to
 * approve, so an approval from a bot or a non-code-owner does not count when
 * the branch rules say it should not.
 */
export function getReviewOutcome(
  pullRequest: ReviewedPullRequest
): ReviewOutcome {
  switch (pullRequest.reviewDecision) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes-requested'
    case 'REVIEW_REQUIRED':
      return 'pending'
  }

  // No review rule applies to the branch, so the reviews themselves decide.
  if (pullRequest.changesRequestedCount > 0) {
    return 'changes-requested'
  }

  if (pullRequest.approvalCount > 0) {
    return 'approved'
  }

  return 'pending'
}

export function getPullRequestStatus(
  pullRequest: PullRequest
): PullRequestStatus {
  if (pullRequest.state === 'MERGED') {
    return 'Merged'
  }

  if (pullRequest.state === 'CLOSED') {
    return 'Closed'
  }

  const reviewOutcome = getReviewOutcome(pullRequest)

  if (reviewOutcome === 'changes-requested') {
    return 'Changes Requested'
  }

  if (reviewOutcome === 'approved') {
    return 'Approved'
  }

  if (pullRequest.isDraft) {
    return 'Draft'
  }

  return 'Pending'
}
