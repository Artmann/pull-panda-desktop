import { describe, expect, it } from 'vitest'

import type { Review } from '@/types/pull-request-details'

import { getLatestReviews } from './get-latest-reviews'

function createMockReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'review-1',
    gitHubId: 'gh-review-1',
    gitHubNumericId: null,
    pullRequestId: 'pr-1',
    state: 'APPROVED',
    body: 'Looks good!',
    bodyHtml: null,
    url: null,
    authorLogin: 'alice',
    authorAvatarUrl: 'https://example.com/alice.png',
    gitHubCreatedAt: '2026-01-01T00:00:00Z',
    gitHubSubmittedAt: '2026-01-01T00:00:00Z',
    syncedAt: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

describe('getLatestReviews', () => {
  it('returns an empty array when given no reviews', () => {
    expect(getLatestReviews([])).toEqual([])
  })

  it('returns the latest review per author', () => {
    const older = createMockReview({
      id: 'review-1',
      authorLogin: 'alice',
      state: 'COMMENTED',
      body: 'Needs work.',
      gitHubSubmittedAt: '2026-01-01T00:00:00Z'
    })

    const newer = createMockReview({
      id: 'review-2',
      authorLogin: 'alice',
      state: 'APPROVED',
      gitHubSubmittedAt: '2026-01-02T00:00:00Z'
    })

    const result = getLatestReviews([older, newer])

    expect(result).toEqual([newer])
  })

  it('filters out PENDING reviews', () => {
    const review = createMockReview({ state: 'PENDING' })

    expect(getLatestReviews([review])).toEqual([])
  })

  it('filters out COMMENTED reviews with empty body', () => {
    const emptyBody = createMockReview({ state: 'COMMENTED', body: '' })
    const nullBody = createMockReview({
      id: 'review-2',
      authorLogin: 'bob',
      state: 'COMMENTED',
      body: null
    })
    const whitespaceBody = createMockReview({
      id: 'review-3',
      authorLogin: 'charlie',
      state: 'COMMENTED',
      body: '   '
    })

    expect(getLatestReviews([emptyBody, nullBody, whitespaceBody])).toEqual([])
  })

  it('keeps COMMENTED reviews with a non-empty body', () => {
    const review = createMockReview({
      state: 'COMMENTED',
      body: 'Great work!'
    })

    expect(getLatestReviews([review])).toEqual([review])
  })

  it('filters out reviews with null authorLogin', () => {
    const review = createMockReview({ authorLogin: null })

    expect(getLatestReviews([review])).toEqual([])
  })

  it('returns one review per unique author', () => {
    const aliceReview = createMockReview({
      id: 'review-1',
      authorLogin: 'alice',
      state: 'APPROVED'
    })

    const bobReview = createMockReview({
      id: 'review-2',
      authorLogin: 'bob',
      state: 'CHANGES_REQUESTED',
      body: 'Please fix.'
    })

    const result = getLatestReviews([aliceReview, bobReview])

    expect(result).toHaveLength(2)
    expect(result).toContainEqual(aliceReview)
    expect(result).toContainEqual(bobReview)
  })

  it('does not let a COMMENTED review replace a CHANGES_REQUESTED review', () => {
    const changesRequested = createMockReview({
      id: 'review-1',
      authorLogin: 'alice',
      state: 'CHANGES_REQUESTED',
      body: 'Please fix.',
      gitHubSubmittedAt: '2026-01-01T00:00:00Z'
    })

    const commented = createMockReview({
      id: 'review-2',
      authorLogin: 'alice',
      state: 'COMMENTED',
      body: 'Actually one more thing.',
      gitHubSubmittedAt: '2026-01-02T00:00:00Z'
    })

    const result = getLatestReviews([changesRequested, commented])

    expect(result).toEqual([changesRequested])
  })

  it('does not let a COMMENTED review replace an APPROVED review', () => {
    const approved = createMockReview({
      id: 'review-1',
      authorLogin: 'alice',
      state: 'APPROVED',
      gitHubSubmittedAt: '2026-01-01T00:00:00Z'
    })

    const commented = createMockReview({
      id: 'review-2',
      authorLogin: 'alice',
      state: 'COMMENTED',
      body: 'Minor nit.',
      gitHubSubmittedAt: '2026-01-02T00:00:00Z'
    })

    const result = getLatestReviews([approved, commented])

    expect(result).toEqual([approved])
  })

  it('lets a newer actionable review replace an older actionable review', () => {
    const changesRequested = createMockReview({
      id: 'review-1',
      authorLogin: 'alice',
      state: 'CHANGES_REQUESTED',
      body: 'Please fix.',
      gitHubSubmittedAt: '2026-01-01T00:00:00Z'
    })

    const approved = createMockReview({
      id: 'review-2',
      authorLogin: 'alice',
      state: 'APPROVED',
      gitHubSubmittedAt: '2026-01-02T00:00:00Z'
    })

    const result = getLatestReviews([changesRequested, approved])

    expect(result).toEqual([approved])
  })
})
