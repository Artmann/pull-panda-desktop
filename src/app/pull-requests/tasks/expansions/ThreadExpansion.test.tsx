/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore, createSlice } from '@reduxjs/toolkit'
import { describe, expect, it, vi } from 'vitest'

import type { Comment } from '@/types/pull-request-details'

import {
  createCommentFixture,
  createPullRequest,
  createThread,
  createThreadTask
} from '../__test-helpers__/factories'

import { ThreadExpansion } from './ThreadExpansion'

vi.mock('@/app/pull-requests/components/CommentThread', () => ({
  CommentThreadCard: ({
    allComments,
    variant
  }: {
    allComments: Comment[]
    variant?: string
  }) => (
    <div
      data-testid="comment-thread-card"
      data-variant={variant}
    >
      {allComments.map((comment) => (
        <span key={comment.id}>{comment.id}</span>
      ))}
    </div>
  ),
  FileCommentThreadCard: ({
    allComments,
    variant
  }: {
    allComments: Comment[]
    variant?: string
  }) => (
    <div
      data-testid="file-comment-thread-card"
      data-variant={variant}
    >
      {allComments.map((comment) => (
        <span key={comment.id}>{comment.id}</span>
      ))}
    </div>
  )
}))

function buildStore(items: Comment[]) {
  const slice = createSlice({
    name: 'comments',
    initialState: { items },
    reducers: {}
  })

  return configureStore({
    reducer: { comments: slice.reducer }
  })
}

describe('ThreadExpansion', () => {
  it('renders FileCommentThreadCard when the anchor comment has a path', () => {
    const anchor = createCommentFixture({ id: 'c-1', path: 'src/app.ts' })
    const store = buildStore([anchor])

    render(
      <Provider store={store}>
        <ThreadExpansion
          pullRequest={createPullRequest()}
          task={createThreadTask({ anchorComment: anchor })}
        />
      </Provider>
    )

    expect(screen.getByTestId('file-comment-thread-card')).toBeDefined()
    expect(screen.queryByTestId('comment-thread-card')).toEqual(null)
  })

  it('renders CommentThreadCard when the anchor has no path', () => {
    const anchor = createCommentFixture({ id: 'c-1', path: null })
    const store = buildStore([anchor])

    render(
      <Provider store={store}>
        <ThreadExpansion
          pullRequest={createPullRequest()}
          task={createThreadTask({ anchorComment: anchor })}
        />
      </Provider>
    )

    expect(screen.getByTestId('comment-thread-card')).toBeDefined()
    expect(screen.queryByTestId('file-comment-thread-card')).toEqual(null)
  })

  it('passes variant="inline" to the rendered card', () => {
    const anchor = createCommentFixture({ id: 'c-1', path: null })
    const store = buildStore([anchor])

    render(
      <Provider store={store}>
        <ThreadExpansion
          pullRequest={createPullRequest()}
          task={createThreadTask({ anchorComment: anchor })}
        />
      </Provider>
    )

    expect(
      screen.getByTestId('comment-thread-card').getAttribute('data-variant')
    ).toEqual('inline')
  })

  it('sorts comments chronologically before passing them in', () => {
    const anchor = createCommentFixture({
      gitHubCreatedAt: '2026-01-01T00:00:00Z',
      gitHubReviewThreadId: 'gh-thread-1',
      id: 'c-anchor',
      path: null
    })
    const newer = createCommentFixture({
      gitHubCreatedAt: '2026-01-03T00:00:00Z',
      gitHubReviewThreadId: 'gh-thread-1',
      id: 'c-newer',
      path: null
    })
    const middle = createCommentFixture({
      gitHubCreatedAt: '2026-01-02T00:00:00Z',
      gitHubReviewThreadId: 'gh-thread-1',
      id: 'c-middle',
      path: null
    })
    const store = buildStore([newer, anchor, middle])

    render(
      <Provider store={store}>
        <ThreadExpansion
          pullRequest={createPullRequest()}
          task={createThreadTask({
            anchorComment: anchor,
            thread: createThread({ gitHubId: 'gh-thread-1' })
          })}
        />
      </Provider>
    )

    const card = screen.getByTestId('comment-thread-card')
    const ids = Array.from(card.querySelectorAll('span')).map(
      (node) => node.textContent
    )

    expect(ids).toEqual(['c-anchor', 'c-middle', 'c-newer'])
  })
})
