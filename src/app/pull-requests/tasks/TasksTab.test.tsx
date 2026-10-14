/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/app/components/ui/tooltip'
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
      <TooltipProvider>
        <TasksTab pullRequest={createPullRequest({ baseRefName: 'main' })} />
      </TooltipProvider>
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
          body: 'Bump the lockfile.',
          gitHubReviewThreadId: 'gh-thread-bot',
          id: 'comment-bot',
          path: null,
          userLogin: 'dependabot'
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
      items: [createThread({ gitHubId: 'gh-thread-bot', id: 'thread-bot' })]
    },
    reviews: { items: [createReviewFixture({ state: 'APPROVED' })] }
  } as never)
}

function groupHeadings(): string[] {
  return screen
    .getAllByRole('heading')
    .map((heading) => heading.textContent ?? '')
}

describe('TasksTab', () => {
  it('shows the four groups and how many tasks are done', () => {
    renderWith(buildPopulatedStore())

    expect(groupHeadings()).toEqual([
      'Checks',
      'Reviews',
      'Conversations',
      'Branch'
    ])
    expect(screen.getByText('3 of 5 done')).toBeDefined()
    expect(screen.getByText('lint is failing')).toBeDefined()
    expect(screen.getByText('Bump the lockfile.')).toBeDefined()
  })

  it('keeps only the blocking groups when the Blockers filter is active', () => {
    renderWith(buildPopulatedStore())

    fireEvent.click(screen.getByRole('button', { name: 'Blockers' }))

    expect(groupHeadings()).toEqual(['Checks'])
  })

  it('hides done tasks when the Open filter is active', () => {
    renderWith(buildPopulatedStore())

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(groupHeadings()).toEqual(['Checks', 'Conversations'])
    expect(screen.queryByText('1 other check passed')).toEqual(null)
  })

  it('says nothing blocks the pull request when the Blockers filter is empty', () => {
    const store = createStore({
      checks: {
        items: [createCheck({ conclusion: 'success', state: 'completed' })]
      },
      comments: { items: [] },
      commits: { items: [] },
      mergeOptions: { 'pr-1': createMergeOptions() },
      modifiedFiles: { items: [] },
      reactions: { byCommentId: {}, byReviewId: {} },
      reviewThreads: { items: [] },
      reviews: { items: [] }
    } as never)

    renderWith(store)

    fireEvent.click(screen.getByRole('button', { name: 'Blockers' }))

    expect(
      screen.getByText('Nothing is blocking this pull request.')
    ).toBeDefined()
  })
})
