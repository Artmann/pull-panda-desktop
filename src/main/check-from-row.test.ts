import { describe, expect, it } from 'vitest'

import { checkFromRow } from './check-from-row'

describe('checkFromRow', () => {
  it('maps a check row and drops the deletedAt column', () => {
    const check = checkFromRow({
      commitSha: 'abc123',
      conclusion: 'success',
      deletedAt: null,
      detailsUrl: 'https://example.com/details',
      durationInSeconds: 42,
      gitHubCreatedAt: '2026-01-01T00:00:00Z',
      gitHubId: 'check-github-id',
      gitHubUpdatedAt: '2026-01-02T00:00:00Z',
      id: 'check-1',
      message: 'All good',
      name: 'build',
      pullRequestId: 'pr-1',
      state: 'completed',
      suiteName: 'CI',
      syncedAt: '2026-01-03T00:00:00Z',
      url: 'https://example.com/check'
    })

    expect(check).toEqual({
      commitSha: 'abc123',
      conclusion: 'success',
      detailsUrl: 'https://example.com/details',
      durationInSeconds: 42,
      gitHubCreatedAt: '2026-01-01T00:00:00Z',
      gitHubId: 'check-github-id',
      gitHubUpdatedAt: '2026-01-02T00:00:00Z',
      id: 'check-1',
      message: 'All good',
      name: 'build',
      pullRequestId: 'pr-1',
      state: 'completed',
      suiteName: 'CI',
      syncedAt: '2026-01-03T00:00:00Z',
      url: 'https://example.com/check'
    })
  })
})
