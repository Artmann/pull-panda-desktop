/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, it, expect } from 'vitest'

import type { PullRequest } from '@/types/pull-request'

import { PullRequestTable } from './PullRequestTable'

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 42,
    title: 'Test PR',
    body: 'Test PR body',
    bodyHtml: null,
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

function renderTable(pullRequests: PullRequest[]) {
  return render(
    <MemoryRouter>
      <PullRequestTable pullRequests={pullRequests} />
    </MemoryRouter>
  )
}

describe('PullRequestTable', () => {
  describe('empty state', () => {
    it('shows "No pull requests in this section." when empty', () => {
      renderTable([])

      expect(
        screen.getByText('No pull requests in this section.')
      ).toBeInTheDocument()
    })

    it('does not render filter when empty', () => {
      renderTable([])

      expect(
        screen.queryByPlaceholderText('Filter pull requests...')
      ).not.toBeInTheDocument()
    })

    it('does not render pagination when empty', () => {
      renderTable([])

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument()
    })
  })

  describe('table rendering', () => {
    it('renders table headers', () => {
      const pullRequests = [createMockPullRequest()]

      renderTable(pullRequests)

      expect(screen.getByText('Pull Request')).toBeInTheDocument()
      expect(screen.getByText('Author')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Activity')).toBeInTheDocument()
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })

    it('renders each PR as a row', () => {
      const pullRequests = [
        createMockPullRequest({ id: 'pr-1', title: 'First PR' }),
        createMockPullRequest({ id: 'pr-2', title: 'Second PR' })
      ]

      renderTable(pullRequests)

      expect(screen.getByText('First PR')).toBeInTheDocument()
      expect(screen.getByText('Second PR')).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('filters by title (case insensitive)', async () => {
      const user = userEvent.setup()
      const pullRequests = [
        createMockPullRequest({ id: 'pr-1', title: 'Fix authentication bug' }),
        createMockPullRequest({ id: 'pr-2', title: 'Add new feature' })
      ]

      renderTable(pullRequests)

      const filterInput = screen.getByPlaceholderText('Filter pull requests...')
      await user.type(filterInput, 'AUTH')

      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
      expect(screen.queryByText('Add new feature')).not.toBeInTheDocument()
    })

    it('filters by author login', async () => {
      const user = userEvent.setup()
      const pullRequests = [
        createMockPullRequest({
          id: 'pr-1',
          title: 'PR by Alice',
          authorLogin: 'alice'
        }),
        createMockPullRequest({
          id: 'pr-2',
          title: 'PR by Bob',
          authorLogin: 'bob'
        })
      ]

      renderTable(pullRequests)

      const filterInput = screen.getByPlaceholderText('Filter pull requests...')
      await user.type(filterInput, 'alice')

      expect(screen.getByText('PR by Alice')).toBeInTheDocument()
      expect(screen.queryByText('PR by Bob')).not.toBeInTheDocument()
    })

    it('filters by repository (owner/repo)', async () => {
      const user = userEvent.setup()
      const pullRequests = [
        createMockPullRequest({
          id: 'pr-1',
          title: 'Frontend fix',
          repositoryOwner: 'company',
          repositoryName: 'frontend'
        }),
        createMockPullRequest({
          id: 'pr-2',
          title: 'Backend fix',
          repositoryOwner: 'company',
          repositoryName: 'backend'
        })
      ]

      renderTable(pullRequests)

      const filterInput = screen.getByPlaceholderText('Filter pull requests...')
      await user.type(filterInput, 'frontend')

      expect(screen.getByText('Frontend fix')).toBeInTheDocument()
      expect(screen.queryByText('Backend fix')).not.toBeInTheDocument()
    })

    it('filters by PR number', async () => {
      const user = userEvent.setup()
      const pullRequests = [
        createMockPullRequest({ id: 'pr-1', title: 'Issue 123', number: 123 }),
        createMockPullRequest({ id: 'pr-2', title: 'Issue 456', number: 456 })
      ]

      renderTable(pullRequests)

      const filterInput = screen.getByPlaceholderText('Filter pull requests...')
      await user.type(filterInput, '123')

      expect(screen.getByText('Issue 123')).toBeInTheDocument()
      expect(screen.queryByText('Issue 456')).not.toBeInTheDocument()
    })

    it('shows "No pull requests match your filter." when no matches', async () => {
      const user = userEvent.setup()
      const pullRequests = [
        createMockPullRequest({ id: 'pr-1', title: 'Test PR' })
      ]

      renderTable(pullRequests)

      const filterInput = screen.getByPlaceholderText('Filter pull requests...')
      await user.type(filterInput, 'nonexistent')

      expect(
        screen.getByText('No pull requests match your filter.')
      ).toBeInTheDocument()
    })

    it('resets to page 1 when filter changes', async () => {
      const user = userEvent.setup()

      // Create 15 PRs to have pagination.
      const pullRequests = Array.from({ length: 15 }, (_, index) =>
        createMockPullRequest({
          id: `pr-${index}`,
          title: `PR number ${index}`,
          number: index
        })
      )

      renderTable(pullRequests)

      // Go to page 2.
      const nextButton = screen.getByRole('button', { name: /next page/i })
      await user.click(nextButton)

      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()

      // Type in filter.
      const filterInput = screen.getByPlaceholderText('Filter pull requests...')
      await user.type(filterInput, 'PR number 1')

      // Should reset to page 1 (matches: PR 1, 10, 11, 12, 13, 14).
      expect(screen.queryByText('Page 2 of')).not.toBeInTheDocument()
    })
  })

  describe('pagination', () => {
    it('does not show pagination when 10 or fewer items', () => {
      const pullRequests = Array.from({ length: 10 }, (_, index) =>
        createMockPullRequest({
          id: `pr-${index}`,
          title: `PR ${index}`
        })
      )

      renderTable(pullRequests)

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument()
    })

    it('shows pagination when more than 10 items', () => {
      const pullRequests = Array.from({ length: 11 }, (_, index) =>
        createMockPullRequest({
          id: `pr-${index}`,
          title: `PR ${index}`
        })
      )

      renderTable(pullRequests)

      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    })

    it('displays correct page count', () => {
      const pullRequests = Array.from({ length: 25 }, (_, index) =>
        createMockPullRequest({
          id: `pr-${index}`,
          title: `PR ${index}`
        })
      )

      renderTable(pullRequests)

      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    })

    it('next/prev navigation works', async () => {
      const user = userEvent.setup()
      const pullRequests = Array.from({ length: 15 }, (_, index) =>
        createMockPullRequest({
          id: `pr-${index}`,
          title: `PR ${index}`
        })
      )

      renderTable(pullRequests)

      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

      const nextButton = screen.getByRole('button', { name: /next page/i })
      await user.click(nextButton)

      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()

      const prevButton = screen.getByRole('button', { name: /previous page/i })
      await user.click(prevButton)

      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    })

    it('disables prev on first page', () => {
      const pullRequests = Array.from({ length: 15 }, (_, index) =>
        createMockPullRequest({
          id: `pr-${index}`,
          title: `PR ${index}`
        })
      )

      renderTable(pullRequests)

      const prevButton = screen.getByRole('button', { name: /previous page/i })

      expect(prevButton).toBeDisabled()
    })

    it('disables next on last page', async () => {
      const user = userEvent.setup()
      const pullRequests = Array.from({ length: 15 }, (_, index) =>
        createMockPullRequest({
          id: `pr-${index}`,
          title: `PR ${index}`
        })
      )

      renderTable(pullRequests)

      const nextButton = screen.getByRole('button', { name: /next page/i })
      await user.click(nextButton)

      expect(nextButton).toBeDisabled()
    })
  })
})
