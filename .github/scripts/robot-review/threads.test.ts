import { describe, expect, it } from 'vitest'

import { commentMarker } from './format'
import { findRobotThreads } from './threads'
import type { ReviewThread } from './types'

function makeThread(
  overrides: Partial<ReviewThread> & {
    body?: string
    databaseId?: number
  } = {}
): ReviewThread {
  const {
    body = `${commentMarker}\n<!-- robot-issue: test-slug -->\n\nBody`,
    databaseId = 100,
    ...rest
  } = overrides

  return {
    comments: {
      nodes: [
        {
          body,
          databaseId,
          id: 'comment-node-id',
          line: 1,
          path: 'src/app.ts'
        }
      ]
    },
    id: 'thread-id',
    isResolved: false,
    ...rest
  }
}

describe('findRobotThreads', () => {
  it('maps unresolved robot threads by slug', () => {
    const threads = [makeThread()]
    const result = findRobotThreads(threads)

    expect(result.size).toEqual(1)
    expect(result.get('test-slug')).toEqual({
      commentId: 100,
      threadId: 'thread-id'
    })
  })

  it('skips threads without the robot marker', () => {
    const threads = [makeThread({ body: 'Just a normal comment' })]
    const result = findRobotThreads(threads)

    expect(result.size).toEqual(0)
  })

  it('skips resolved threads', () => {
    const threads = [makeThread({ isResolved: true })]
    const result = findRobotThreads(threads)

    expect(result.size).toEqual(0)
  })

  it('skips threads with no comments', () => {
    const threads: ReviewThread[] = [
      {
        comments: { nodes: [] },
        id: 'empty-thread',
        isResolved: false
      }
    ]
    const result = findRobotThreads(threads)

    expect(result.size).toEqual(0)
  })

  it('handles empty thread list', () => {
    const result = findRobotThreads([])

    expect(result.size).toEqual(0)
  })

  it('handles multiple threads with different slugs', () => {
    const threads = [
      makeThread({
        body: `${commentMarker}\n<!-- robot-issue: slug-one -->\n\nFirst`,
        databaseId: 1,
        id: 'thread-1'
      }),
      makeThread({
        body: `${commentMarker}\n<!-- robot-issue: slug-two -->\n\nSecond`,
        databaseId: 2,
        id: 'thread-2'
      })
    ]

    const result = findRobotThreads(threads)

    expect(result.size).toEqual(2)
    expect(result.get('slug-one')).toEqual({
      commentId: 1,
      threadId: 'thread-1'
    })
    expect(result.get('slug-two')).toEqual({
      commentId: 2,
      threadId: 'thread-2'
    })
  })
})
