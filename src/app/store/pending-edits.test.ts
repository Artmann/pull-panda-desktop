import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PullRequest } from '@/types/pull-request'
import type { Comment } from '@/types/pull-request-details'

import type { RootState } from '.'
import { keepPendingEdits, pendingEditKeys } from './pending-edits'

const pendingKeys = vi.hoisted(() => new Set<string>())

vi.mock('@/app/lib/mutations/run-serial-mutation', () => ({
  isSerialMutationPending: (key: string) => pendingKeys.has(key)
}))

const pullRequest = { body: '- [x] Ship it', id: 'pr_1' } as PullRequest
const comment = { body: '- [x] Reply', id: 'c_1' } as Comment

const state = {
  comments: { items: [comment] },
  pullRequests: { items: [pullRequest] }
} as unknown as RootState

describe('keepPendingEdits', () => {
  afterEach(() => {
    pendingKeys.clear()
  })

  it('keeps the local body of a pull request that is still saving', () => {
    pendingKeys.add(pendingEditKeys.pullRequestBody('pr_1'))

    const event = keepPendingEdits(
      {
        data: { ...pullRequest, body: '- [ ] Ship it', title: 'New title' },
        pullRequestId: 'pr_1',
        type: 'pull-request'
      },
      state
    )

    expect(event).toEqual({
      data: { ...pullRequest, body: '- [x] Ship it', title: 'New title' },
      pullRequestId: 'pr_1',
      type: 'pull-request'
    })
  })

  it('keeps the local body of a comment that is still saving', () => {
    pendingKeys.add(pendingEditKeys.commentBody('c_1'))

    const other = { body: 'Other', id: 'c_2' } as Comment

    const event = keepPendingEdits(
      {
        data: [{ ...comment, body: '- [ ] Reply' }, other],
        pullRequestId: 'pr_1',
        type: 'comments'
      },
      state
    )

    expect(event).toEqual({
      data: [comment, other],
      pullRequestId: 'pr_1',
      type: 'comments'
    })
  })

  it('passes updates through when nothing is saving', () => {
    const event = {
      data: [{ ...pullRequest, body: 'From GitHub' }],
      type: 'pull-requests' as const
    }

    expect(keepPendingEdits(event, state)).toEqual(event)
  })
})
