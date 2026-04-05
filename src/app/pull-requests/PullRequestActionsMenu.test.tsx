/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PullRequest } from '@/types/pull-request'
import { updatePullRequest } from '@/app/lib/api'
import pullRequestsReducer from '@/app/store/pull-requests-slice'

import { PullRequestActionsMenu } from './PullRequestActionsMenu'

vi.mock('@/app/lib/api', () => ({
  updatePullRequest: vi.fn()
}))

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    approvalCount: 0,
    assignees: [],
    authorAvatarUrl: 'https://example.com/avatar.png',
    authorLogin: 'testuser',
    body: 'Test PR body',
    bodyHtml: null,
    headRefName: null,
    changesRequestedCount: 0,
    closedAt: null,
    commentCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: null,
    id: 'PR_kwDOQ5j5ms69Gkph',
    isAssignee: false,
    isAuthor: false,
    isDraft: false,
    isReviewer: false,
    labels: [],
    mergedAt: null,
    number: 42,
    repositoryName: 'repo',
    repositoryOwner: 'owner',
    state: 'OPEN',
    syncedAt: '2024-01-01T00:00:00Z',
    title: 'Test PR',
    updatedAt: '2024-01-01T00:00:00Z',
    url: 'https://github.com/owner/repo/pull/42',
    ...overrides
  }
}

function createTestStore(pullRequest: PullRequest) {
  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
    reducer: { pullRequests: pullRequestsReducer },
    preloadedState: { pullRequests: { items: [pullRequest] } }
  })
}

function renderMenu(pullRequest: PullRequest) {
  const store = createTestStore(pullRequest)
  const user = userEvent.setup()

  render(
    <Provider store={store}>
      <PullRequestActionsMenu pullRequest={pullRequest} />
    </Provider>
  )

  return { store, user }
}

describe('PullRequestActionsMenu', () => {
  beforeEach(() => {
    vi.mocked(updatePullRequest).mockResolvedValue(createMockPullRequest())
  })

  describe('OPEN PR (not draft)', () => {
    it('renders the trigger button', () => {
      renderMenu(createMockPullRequest())
      expect(screen.getByTitle('More actions')).toBeInTheDocument()
    })

    it('opens the menu and shows correct items', async () => {
      const { user } = renderMenu(createMockPullRequest())

      const t0 = performance.now()
      await user.click(screen.getByTitle('More actions'))
      console.log(`[perf] open menu: ${(performance.now() - t0).toFixed(2)}ms`)

      expect(screen.getByText('Mark as draft')).toBeInTheDocument()
      expect(screen.getByText('Close pull request')).toBeInTheDocument()
    })

    it('clicking "Mark as draft" dispatches optimistic update immediately', async () => {
      const pullRequest = createMockPullRequest({ isDraft: false })
      vi.mocked(updatePullRequest).mockResolvedValue(
        createMockPullRequest({ isDraft: true })
      )
      const { store, user } = renderMenu(pullRequest)

      await user.click(screen.getByTitle('More actions'))

      const t0 = performance.now()
      await user.click(screen.getByText('Mark as draft'))
      console.log(
        `[perf] "Mark as draft" click + optimistic: ${(performance.now() - t0).toFixed(2)}ms`
      )

      const state = store
        .getState()
        .pullRequests.items.find((pr) => pr.id === pullRequest.id)
      expect(state).toEqual(expect.objectContaining({ isDraft: true }))
      expect(updatePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ isDraft: true })
      )
    })

    it('clicking "Close pull request" dispatches optimistic update immediately', async () => {
      const pullRequest = createMockPullRequest({ state: 'OPEN' })
      vi.mocked(updatePullRequest).mockResolvedValue(
        createMockPullRequest({ state: 'CLOSED' })
      )
      const { store, user } = renderMenu(pullRequest)

      await user.click(screen.getByTitle('More actions'))

      const t0 = performance.now()
      await user.click(screen.getByText('Close pull request'))
      console.log(
        `[perf] "Close pull request" click + optimistic: ${(performance.now() - t0).toFixed(2)}ms`
      )

      const state = store
        .getState()
        .pullRequests.items.find((pr) => pr.id === pullRequest.id)
      expect(state).toEqual(expect.objectContaining({ state: 'CLOSED' }))
      expect(updatePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' })
      )
    })

    it('rolls back optimistic update on API error', async () => {
      vi.mocked(updatePullRequest).mockRejectedValue(new Error('Network error'))

      const pullRequest = createMockPullRequest({ isDraft: false })
      const { store, user } = renderMenu(pullRequest)

      await user.click(screen.getByTitle('More actions'))
      await user.click(screen.getByText('Mark as draft'))

      // After act() flushes the rejection, the rollback should have fired
      await waitFor(() => {
        expect(
          store
            .getState()
            .pullRequests.items.find((pr) => pr.id === pullRequest.id)
        ).toEqual(expect.objectContaining({ isDraft: false }))
      })
    })
  })

  describe('OPEN PR (draft)', () => {
    it('shows "Mark as ready for review" for draft PRs', async () => {
      const { user } = renderMenu(createMockPullRequest({ isDraft: true }))

      await user.click(screen.getByTitle('More actions'))

      expect(screen.getByText('Mark as ready for review')).toBeInTheDocument()
    })

    it('clicking "Mark as ready for review" dispatches optimistic update immediately', async () => {
      const pullRequest = createMockPullRequest({ isDraft: true })
      const { store, user } = renderMenu(pullRequest)

      await user.click(screen.getByTitle('More actions'))
      await user.click(screen.getByText('Mark as ready for review'))

      expect(
        store
          .getState()
          .pullRequests.items.find((pr) => pr.id === pullRequest.id)
      ).toEqual(expect.objectContaining({ isDraft: false }))
    })
  })

  describe('CLOSED PR', () => {
    it('shows "Reopen pull request" only', async () => {
      const { user } = renderMenu(createMockPullRequest({ state: 'CLOSED' }))

      await user.click(screen.getByTitle('More actions'))

      expect(screen.getByText('Reopen pull request')).toBeInTheDocument()
      expect(screen.queryByText('Mark as draft')).not.toBeInTheDocument()
      expect(screen.queryByText('Close pull request')).not.toBeInTheDocument()
    })

    it('clicking "Reopen pull request" dispatches optimistic update immediately', async () => {
      const pullRequest = createMockPullRequest({ state: 'CLOSED' })
      const { store, user } = renderMenu(pullRequest)

      await user.click(screen.getByTitle('More actions'))
      await user.click(screen.getByText('Reopen pull request'))

      expect(
        store
          .getState()
          .pullRequests.items.find((pr) => pr.id === pullRequest.id)
      ).toEqual(expect.objectContaining({ state: 'OPEN' }))
    })
  })

  describe('MERGED PR', () => {
    it('shows no items (parent hides the menu for merged PRs)', async () => {
      const { user } = renderMenu(createMockPullRequest({ state: 'MERGED' }))

      await user.click(screen.getByTitle('More actions'))

      expect(screen.queryByText('Mark as draft')).not.toBeInTheDocument()
      expect(screen.queryByText('Close pull request')).not.toBeInTheDocument()
      expect(screen.queryByText('Reopen pull request')).not.toBeInTheDocument()
    })
  })
})
