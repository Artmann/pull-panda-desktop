/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createStore, type AppStore } from '@/app/store'

import {
  createCheck,
  createCommentFixture,
  createMergeOptions,
  createPullRequest,
  createReviewFixture,
  createThread
} from './__test-helpers__/factories'
import { TasksTab } from './TasksTab'

vi.mock('./expansions/ThreadExpansion', () => ({
  ThreadExpansion: () => <div data-testid="thread-expansion-stub" />
}))

vi.mock('./expansions/RequirementExpansion', () => ({
  RequirementExpansion: () => <div data-testid="requirement-expansion-stub" />
}))

beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn()
  }))

  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    takeRecords: vi.fn().mockReturnValue([]),
    unobserve: vi.fn()
  }))
})

beforeEach(() => {
  window.electron = {
    ...window.electron,
    openUrl: vi.fn()
  }
})

function renderWith(store: AppStore) {
  return render(
    <Provider store={store}>
      <TasksTab pullRequest={createPullRequest()} />
    </Provider>
  )
}

function buildPopulatedStore(): AppStore {
  return createStore({
    checks: {
      items: [
        createCheck({
          conclusion: 'failure',
          id: 'check-failed',
          name: 'lint',
          state: 'completed'
        }),
        createCheck({
          conclusion: 'success',
          id: 'check-passed',
          name: 'unit-tests',
          state: 'completed'
        })
      ]
    },
    comments: {
      items: [
        createCommentFixture({
          gitHubReviewThreadId: 'gh-thread-bot',
          id: 'comment-bot',
          path: null,
          userLogin: 'dependabot'
        }),
        createCommentFixture({
          gitHubReviewThreadId: 'gh-thread-human',
          id: 'comment-human',
          path: null,
          userLogin: 'alice'
        })
      ]
    },
    commits: { items: [] },
    mergeOptions: {
      'pr-1': createMergeOptions({ mergeableState: 'clean' })
    },
    modifiedFiles: { items: [] },
    reactions: { byCommentId: {}, byReviewId: {} },
    reviewThreads: {
      items: [
        createThread({
          gitHubId: 'gh-thread-bot',
          id: 'thread-bot'
        }),
        createThread({
          gitHubId: 'gh-thread-human',
          id: 'thread-human'
        })
      ]
    },
    reviews: { items: [createReviewFixture({ state: 'APPROVED' })] }
  } as never)
}

describe('TasksTab', () => {
  it('renders the readiness summary, filter bar, and one card per non-empty group', () => {
    const store = buildPopulatedStore()
    renderWith(store)

    expect(screen.getByText(/blockers? before this can merge/i)).toBeDefined()
    expect(screen.getByRole('button', { name: 'All' })).toBeDefined()
    expect(screen.getByText('CI & automation')).toBeDefined()
    expect(screen.getByText('Human reviewers')).toBeDefined()
    expect(screen.getByText('AI agents & bots')).toBeDefined()
  })

  it('shows the no-tasks empty state when the store is empty', () => {
    const store = createStore()
    renderWith(store)

    expect(
      screen.getByText('Nothing to do here. This PR is ready.')
    ).toBeDefined()
  })

  it('hides non-blocker groups when the Blockers filter is active', () => {
    const store = createStore({
      checks: {
        items: [
          createCheck({
            conclusion: 'failure',
            id: 'check-failed',
            name: 'lint',
            state: 'completed'
          })
        ]
      },
      comments: {
        items: [
          createCommentFixture({
            gitHubReviewThreadId: 'gh-thread-bot',
            id: 'comment-bot',
            path: null,
            userLogin: 'dependabot'
          })
        ]
      },
      commits: { items: [] },
      modifiedFiles: { items: [] },
      reactions: { byCommentId: {}, byReviewId: {} },
      reviewThreads: {
        items: [
          createThread({
            gitHubId: 'gh-thread-bot',
            id: 'thread-bot'
          })
        ]
      },
      reviews: { items: [] }
    } as never)

    renderWith(store)

    expect(screen.getByText('AI agents & bots')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Blockers only' }))

    expect(screen.queryByText('AI agents & bots')).toEqual(null)
    expect(screen.getByText('CI & automation')).toBeDefined()
  })

  it('hides done summary tasks when "Hide resolved" is toggled on', () => {
    const store = createStore({
      checks: {
        items: [
          createCheck({
            conclusion: 'success',
            id: 'check-passed',
            name: 'lint',
            state: 'completed'
          })
        ]
      },
      comments: { items: [] },
      commits: { items: [] },
      modifiedFiles: { items: [] },
      reactions: { byCommentId: {}, byReviewId: {} },
      reviewThreads: { items: [] },
      reviews: { items: [] }
    } as never)

    renderWith(store)

    expect(screen.getByText('All checks have passed')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /hide resolved/i }))

    expect(screen.queryByText('All checks have passed')).toEqual(null)
  })

  it('shows the filtered empty state when no tasks match the active filter', () => {
    const store = createStore({
      checks: {
        items: [
          createCheck({
            conclusion: 'success',
            id: 'check-passed',
            name: 'lint',
            state: 'completed'
          })
        ]
      },
      comments: { items: [] },
      commits: { items: [] },
      modifiedFiles: { items: [] },
      reactions: { byCommentId: {}, byReviewId: {} },
      reviewThreads: { items: [] },
      reviews: { items: [] }
    } as never)

    renderWith(store)

    fireEvent.click(screen.getByRole('button', { name: 'Blockers only' }))

    expect(screen.getByText('No tasks match the current filter.')).toBeDefined()
  })
})
