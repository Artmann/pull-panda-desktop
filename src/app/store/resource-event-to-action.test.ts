import { describe, expect, it } from 'vitest'

import type { PendingReview } from '@/main/bootstrap'
import type { PullRequest } from '@/types/pull-request'

import { checksActions } from '@/app/store/checks-slice'
import { commentsActions } from '@/app/store/comments-slice'
import { commitsActions } from '@/app/store/commits-slice'
import { modifiedFilesActions } from '@/app/store/modified-files-slice'
import { pendingReviewsActions } from '@/app/store/pending-reviews-slice'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { reactionsActions } from '@/app/store/reactions-slice'
import { reviewsActions } from '@/app/store/reviews-slice'
import { reviewThreadsActions } from '@/app/store/review-threads-slice'

import { resourceEventToAction } from './resource-event-to-action'

function createPullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 'pr-1',
    number: 1,
    title: 'Test PR',
    body: null,
    bodyHtml: null,
    headRefName: null,
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/1',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    authorLogin: 'testuser',
    authorAvatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    isDraft: false,
    isAuthor: true,
    isAssignee: false,
    isReviewer: false,
    labels: [],
    assignees: [],
    requestedReviewers: [],
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: '2024-01-01T00:01:00Z',
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}

function createPendingReview(): PendingReview {
  return {
    authorAvatarUrl: null,
    authorLogin: 'testuser',
    body: null,
    gitHubId: 'review-github-1',
    gitHubNumericId: 1,
    id: 'review-1',
    isCollapsed: false,
    pullRequestId: 'pr-1',
    state: 'PENDING'
  }
}

describe('resourceEventToAction', () => {
  it('maps a checks event to checksActions.setForPullRequest', () => {
    const action = resourceEventToAction({
      data: [],
      pullRequestId: 'pr-1',
      type: 'checks'
    })

    expect(action).toEqual(
      checksActions.setForPullRequest({ pullRequestId: 'pr-1', items: [] })
    )
  })

  it('maps a comments event to commentsActions.setForPullRequest', () => {
    const action = resourceEventToAction({
      data: [],
      pullRequestId: 'pr-1',
      type: 'comments'
    })

    expect(action).toEqual(
      commentsActions.setForPullRequest({ pullRequestId: 'pr-1', items: [] })
    )
  })

  it('maps a commits event to commitsActions.setForPullRequest', () => {
    const action = resourceEventToAction({
      data: [],
      pullRequestId: 'pr-1',
      type: 'commits'
    })

    expect(action).toEqual(
      commitsActions.setForPullRequest({ pullRequestId: 'pr-1', items: [] })
    )
  })

  it('maps a modified-files event to modifiedFilesActions.setForPullRequest', () => {
    const action = resourceEventToAction({
      data: [],
      pullRequestId: 'pr-1',
      type: 'modified-files'
    })

    expect(action).toEqual(
      modifiedFilesActions.setForPullRequest({
        pullRequestId: 'pr-1',
        items: []
      })
    )
  })

  it('maps a pending-review event with data to pendingReviewsActions.setReview', () => {
    const review = createPendingReview()

    const action = resourceEventToAction({
      data: review,
      pullRequestId: 'pr-1',
      type: 'pending-review'
    })

    expect(action).toEqual(
      pendingReviewsActions.setReview({ pullRequestId: 'pr-1', review })
    )
  })

  it('maps a pending-review event without data to pendingReviewsActions.clearReview', () => {
    const action = resourceEventToAction({
      data: null,
      pullRequestId: 'pr-1',
      type: 'pending-review'
    })

    expect(action).toEqual(
      pendingReviewsActions.clearReview({ pullRequestId: 'pr-1' })
    )
  })

  it('maps a pull-request event to pullRequestsActions.upsertItem', () => {
    const pullRequest = createPullRequest()

    const action = resourceEventToAction({
      data: pullRequest,
      pullRequestId: 'pr-1',
      type: 'pull-request'
    })

    expect(action).toEqual(pullRequestsActions.upsertItem(pullRequest))
  })

  it('maps a pull-requests event to pullRequestsActions.setItems with only ready pull requests', () => {
    const ready = createPullRequest({ id: 'pr-ready' })
    const notReady = createPullRequest({
      id: 'pr-not-ready',
      detailsSyncedAt: null
    })

    const action = resourceEventToAction({
      data: [ready, notReady],
      type: 'pull-requests'
    })

    expect(action).toEqual(pullRequestsActions.setItems([ready]))
  })

  it('maps a reactions event to reactionsActions.setForPullRequest', () => {
    const action = resourceEventToAction({
      data: [],
      pullRequestId: 'pr-1',
      type: 'reactions'
    })

    expect(action).toEqual(
      reactionsActions.setForPullRequest({ pullRequestId: 'pr-1', items: [] })
    )
  })

  it('maps a reviews event to reviewsActions.setForPullRequest', () => {
    const action = resourceEventToAction({
      data: [],
      pullRequestId: 'pr-1',
      type: 'reviews'
    })

    expect(action).toEqual(
      reviewsActions.setForPullRequest({ pullRequestId: 'pr-1', items: [] })
    )
  })

  it('maps a review-threads event to reviewThreadsActions.setForPullRequest', () => {
    const action = resourceEventToAction({
      data: [],
      pullRequestId: 'pr-1',
      type: 'review-threads'
    })

    expect(action).toEqual(
      reviewThreadsActions.setForPullRequest({
        pullRequestId: 'pr-1',
        items: []
      })
    )
  })
})
