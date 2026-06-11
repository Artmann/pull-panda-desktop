import type { Review } from '@/types/pull-request-details'

const actionableStates = new Set(['APPROVED', 'CHANGES_REQUESTED'])

function isActionable(review: Review): boolean {
  return actionableStates.has(review.state)
}

function getTimestamp(review: Review): string {
  return review.gitHubSubmittedAt ?? review.syncedAt
}

function isCounted(review: Review): boolean {
  if (review.state === 'PENDING') {
    return false
  }

  if (review.state === 'COMMENTED' && (review.body ?? '').trim() === '') {
    return false
  }

  return true
}

// A COMMENTED review never replaces an actionable (APPROVED / CHANGES_REQUESTED) one.
// Only a newer actionable review can replace an existing actionable review.
function replaces(existing: Review, candidate: Review): boolean {
  if (isActionable(existing) && !isActionable(candidate)) {
    return false
  }

  return getTimestamp(candidate) > getTimestamp(existing)
}

export function getLatestReviews(reviews: Review[]): Review[] {
  const latestByAuthor = new Map<string, Review>()

  for (const review of reviews) {
    const author = review.authorLogin

    if (!author || !isCounted(review)) {
      continue
    }

    const existing = latestByAuthor.get(author)

    if (!existing || replaces(existing, review)) {
      latestByAuthor.set(author, review)
    }
  }

  return [...latestByAuthor.values()]
}
