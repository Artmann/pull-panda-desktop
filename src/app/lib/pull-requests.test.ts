import { describe, expect, it } from 'vitest'

import type { PullRequest } from '@/types/pull-request'

import { filterReadyPullRequests } from './pull-requests'

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 1,
    title: 'Test PR',
    body: null,
    bodyHtml: null,
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
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: '2024-01-01T00:01:00Z',
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}

describe('filterReadyPullRequests', () => {
  it('returns an empty array for nullish input', () => {
    expect(filterReadyPullRequests(undefined)).toEqual([])
    expect(filterReadyPullRequests(null)).toEqual([])
  })

  it('filters out pull requests without detailsSyncedAt', () => {
    const ready = createMockPullRequest({ id: 'ready' })
    const notReady = createMockPullRequest({
      id: 'not-ready',
      detailsSyncedAt: null
    })

    expect(filterReadyPullRequests([ready, notReady])).toEqual([ready])
  })
})
