import { describe, expect, it } from 'vitest'

import { createMockPullRequest } from '@/app/pull-requests/__test-helpers__/pull-request-fixtures'

import { getPullRequestStatus, getReviewOutcome } from './pull-request-status'

describe('getReviewOutcome', () => {
  it('follows GitHub’s review decision over the review counts', () => {
    expect([
      getReviewOutcome({
        approvalCount: 1,
        changesRequestedCount: 0,
        reviewDecision: 'REVIEW_REQUIRED'
      }),
      getReviewOutcome({
        approvalCount: 0,
        changesRequestedCount: 0,
        reviewDecision: 'APPROVED'
      }),
      getReviewOutcome({
        approvalCount: 1,
        changesRequestedCount: 0,
        reviewDecision: 'CHANGES_REQUESTED'
      })
    ]).toEqual(['pending', 'approved', 'changes-requested'])
  })

  it('falls back to the review counts without a review decision', () => {
    expect([
      getReviewOutcome({
        approvalCount: 1,
        changesRequestedCount: 1,
        reviewDecision: null
      }),
      getReviewOutcome({
        approvalCount: 1,
        changesRequestedCount: 0,
        reviewDecision: null
      }),
      getReviewOutcome({
        approvalCount: 0,
        changesRequestedCount: 0,
        reviewDecision: null
      })
    ]).toEqual(['changes-requested', 'approved', 'pending'])
  })
})

describe('getPullRequestStatus', () => {
  it('is pending when an approval is missing a required code owner review', () => {
    const pullRequest = createMockPullRequest({
      approvalCount: 1,
      reviewDecision: 'REVIEW_REQUIRED'
    })

    expect(getPullRequestStatus(pullRequest)).toEqual('Pending')
  })

  it('is approved when GitHub says the reviews are satisfied', () => {
    const pullRequest = createMockPullRequest({
      approvalCount: 1,
      reviewDecision: 'APPROVED'
    })

    expect(getPullRequestStatus(pullRequest)).toEqual('Approved')
  })
})
