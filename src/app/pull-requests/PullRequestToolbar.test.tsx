/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect } from 'vitest'

import type { PullRequest } from '@/types/pull-request'

import {
  createTestQueryClient,
  QueryWrapper
} from '@/app/lib/test-query-wrapper'
import { queryKeys } from '@/app/lib/query-keys'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'

import { PullRequestToolbar } from './PullRequestToolbar'

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 42,
    title: 'Test PR',
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/42',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    authorLogin: 'testuser',
    authorAvatarUrl: 'https://example.com/avatar.png',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    body: 'Test PR body',
    bodyHtml: null,
    isDraft: false,
    isAuthor: false,
    isAssignee: false,
    isReviewer: false,
    labels: [],
    assignees: [],
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: null,
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}

function createReduxStore() {
  return configureStore({
    reducer: {
      pendingReviewComments: pendingReviewCommentsReducer
    },
    preloadedState: {
      pendingReviewComments: {}
    }
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  const store = createReduxStore()

  // Seed empty pending reviews for the PR so the query resolves.
  queryClient.setQueryData(queryKeys.pendingReviews.byPullRequest('pr-1'), null)

  return render(
    <QueryWrapper client={queryClient}>
      <Provider store={store}>{ui}</Provider>
    </QueryWrapper>
  )
}

describe('PullRequestToolbar', () => {
  it('shows "Start review" button when user is not the author', () => {
    const pullRequest = createMockPullRequest({ isAuthor: false })

    renderWithProviders(<PullRequestToolbar pullRequest={pullRequest} />)

    expect(screen.getByText('Start review')).toBeInTheDocument()
  })

  it('hides "Start review" button when user is the author', () => {
    const pullRequest = createMockPullRequest({ isAuthor: true })

    renderWithProviders(<PullRequestToolbar pullRequest={pullRequest} />)

    expect(screen.queryByText('Start review')).not.toBeInTheDocument()
  })
})
