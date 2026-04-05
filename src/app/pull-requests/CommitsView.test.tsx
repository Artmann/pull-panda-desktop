/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi, beforeAll } from 'vitest'

import type { Commit } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import commitsReducer from '@/app/store/commits-slice'

import { CommitsView } from './CommitsView'

beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
})

function createMockCommit(overrides: Partial<Commit> = {}): Commit {
  return {
    id: 'commit-1',
    gitHubId: 'C_kwDOExample123',
    pullRequestId: 'pr-1',
    hash: 'abc1234567890',
    message: 'Add new feature\n\nThis is the body of the commit message.',
    url: 'https://github.com/owner/repo/commit/abc1234567890',
    authorLogin: 'testuser',
    authorAvatarUrl: 'https://example.com/avatar.png',
    linesAdded: 10,
    linesRemoved: 5,
    gitHubCreatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    ...overrides
  }
}

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 7,
    title: 'Test PR',
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/7',
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
    headRefName: null,
    isDraft: false,
    isAuthor: true,
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

function createTestStore(preloadedState?: { commits?: { items: Commit[] } }) {
  return configureStore({
    reducer: {
      commits: commitsReducer
    },
    preloadedState
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(<Provider store={store}>{ui}</Provider>)
}

describe('CommitsView', () => {
  it('renders empty state when no commits', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      commits: { items: [] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('No commits found.')).toBeInTheDocument()
  })

  it('renders commits with title and author', async () => {
    const pullRequest = createMockPullRequest()
    const commit = createMockCommit({
      message: 'Fix authentication bug',
      authorLogin: 'developer'
    })
    const store = createTestStore({
      commits: { items: [commit] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    expect(screen.getByText('developer')).toBeInTheDocument()
  })

  it('renders commit with body when message has multiple lines', async () => {
    const pullRequest = createMockPullRequest()
    const commit = createMockCommit({
      message: 'Add new feature\n\nThis adds a new feature to the app.'
    })
    const store = createTestStore({
      commits: { items: [commit] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Add new feature')).toBeInTheDocument()
    expect(
      screen.getByText('This adds a new feature to the app.')
    ).toBeInTheDocument()
  })

  it('displays short hash', async () => {
    const pullRequest = createMockPullRequest()
    const commit = createMockCommit({
      hash: 'abc1234567890def'
    })
    const store = createTestStore({
      commits: { items: [commit] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('abc1234')).toBeInTheDocument()
  })

  it('displays lines added and removed', async () => {
    const pullRequest = createMockPullRequest()
    const commit = createMockCommit({
      linesAdded: 42,
      linesRemoved: 13
    })
    const store = createTestStore({
      commits: { items: [commit] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('+42')).toBeInTheDocument()
    expect(screen.getByText('-13')).toBeInTheDocument()
  })

  it('shows "Today" for commits from today', async () => {
    const pullRequest = createMockPullRequest()
    const commit = createMockCommit({
      gitHubCreatedAt: new Date().toISOString()
    })
    const store = createTestStore({
      commits: { items: [commit] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('shows "Yesterday" for commits from yesterday', async () => {
    const pullRequest = createMockPullRequest()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const commit = createMockCommit({
      gitHubCreatedAt: yesterday.toISOString()
    })
    const store = createTestStore({
      commits: { items: [commit] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('handles null message gracefully', async () => {
    const pullRequest = createMockPullRequest()
    const commit = createMockCommit({
      message: null
    })
    const store = createTestStore({
      commits: { items: [commit] }
    })

    await act(async () => {
      renderWithProviders(<CommitsView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('No message')).toBeInTheDocument()
  })
})
