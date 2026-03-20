import type { Review } from '@/types/pull-request-details'

const actionableStates = new Set(['APPROVED', 'CHANGES_REQUESTED'])

function isActionable(review: Review): boolean {
  return actionableStates.has(review.state)
}

function getTimestamp(review: Review): string {
  return review.gitHubSubmittedAt ?? review.syncedAt
}

export function getLatestReviews(reviews: Review[]): Review[] {
  const latestByAuthor = new Map<string, Review>()

  for (const review of reviews) {
    if (!review.authorLogin) continue
    if (review.state === 'PENDING') continue
    if (review.state === 'COMMENTED' && (review.body ?? '').trim() === '') {
      continue
    }

    const existing = latestByAuthor.get(review.authorLogin)

    if (!existing) {
      latestByAuthor.set(review.authorLogin, review)
      continue
    }

    // A COMMENTED review never replaces an actionable (APPROVED / CHANGES_REQUESTED) one.
    // Only a newer actionable review can replace an existing actionable review.
    if (isActionable(existing) && !isActionable(review)) {
      continue
    }

    if (getTimestamp(review) > getTimestamp(existing)) {
      latestByAuthor.set(review.authorLogin, review)
    }
  }

  return [...latestByAuthor.values()]
}

/** Whether the user's latest review on this PR is an approval (same rules as {@link getLatestReviews}). */
export function hasLatestApprovalFromUser(
  reviews: Review[],
  pullRequestId: string,
  userLogin: string
): boolean {
  const normalized = userLogin.trim().toLowerCase()

  if (!normalized) {
    return false
  }

  const forPullRequest = reviews.filter(
    (review) => review.pullRequestId === pullRequestId
  )

  const latest = getLatestReviews(forPullRequest)

  return latest.some(
    (review) =>
      review.authorLogin?.trim().toLowerCase() === normalized &&
      review.state === 'APPROVED'
  )
}
