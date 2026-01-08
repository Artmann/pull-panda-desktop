import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getDatabase } from '../database'
import { pullRequests } from '../database/schema'
import { setupTestDatabase, teardownTestDatabase } from './test-helpers'

vi.mock('./syncChecks', () => ({
  syncChecks: vi.fn()
}))

vi.mock('./syncCommits', () => ({
  syncCommits: vi.fn()
}))

vi.mock('./syncFiles', () => ({
  syncFiles: vi.fn()
}))

vi.mock('./syncReviews', () => ({
  syncReviews: vi.fn()
}))

vi.mock('./syncComments', () => ({
  syncComments: vi.fn()
}))

import { syncChecks } from './syncChecks'
import { syncCommits } from './syncCommits'
import { syncFiles } from './syncFiles'
import { syncReviews } from './syncReviews'
import { syncComments } from './syncComments'
import { syncPullRequestDetails } from './syncPullRequestDetails'

describe('syncPullRequestDetails', () => {
  beforeEach(async () => {
    await setupTestDatabase()
    vi.clearAllMocks()

    vi.mocked(syncChecks).mockResolvedValue(undefined)
    vi.mocked(syncCommits).mockResolvedValue(undefined)
    vi.mocked(syncFiles).mockResolvedValue(undefined)
    vi.mocked(syncReviews).mockResolvedValue(undefined)
    vi.mocked(syncComments).mockResolvedValue(undefined)

    // Insert test PR records for the tests that need them
    const db = getDatabase()

    db.insert(pullRequests).values({
      id: 'pr-123',
      number: 1,
      title: 'Test PR',
      state: 'OPEN',
      url: 'https://github.com/test/test/pull/1',
      repositoryOwner: 'testowner',
      repositoryName: 'testrepo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    }).run()

    db.insert(pullRequests).values({
      id: 'pr-456',
      number: 42,
      title: 'Test PR 2',
      state: 'OPEN',
      url: 'https://github.com/test/test/pull/42',
      repositoryOwner: 'myowner',
      repositoryName: 'myrepo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    }).run()
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should call all syncers with token', async () => {
    await syncPullRequestDetails({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(syncChecks).toHaveBeenCalledWith({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(syncCommits).toHaveBeenCalledWith({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(syncFiles).toHaveBeenCalledWith({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(syncReviews).toHaveBeenCalledWith({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(syncComments).toHaveBeenCalledWith({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })
  })

  it('should return success when all syncers succeed', async () => {
    const result = await syncPullRequestDetails({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(result).toEqual({
      success: true,
      errors: []
    })
  })

  it('should collect errors from failed syncers', async () => {
    vi.mocked(syncChecks).mockRejectedValue(new Error('Checks failed'))
    vi.mocked(syncCommits).mockRejectedValue(new Error('Commits failed'))

    const result = await syncPullRequestDetails({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(result.success).toEqual(false)
    expect(result.errors).toHaveLength(2)
    expect(result.errors).toContain('Checks sync failed: Checks failed')
    expect(result.errors).toContain('Commits sync failed: Commits failed')
  })

  it('should continue syncing even when some syncers fail', async () => {
    vi.mocked(syncChecks).mockRejectedValue(new Error('Checks failed'))

    await syncPullRequestDetails({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(syncChecks).toHaveBeenCalled()
    expect(syncCommits).toHaveBeenCalled()
    expect(syncFiles).toHaveBeenCalled()
    expect(syncReviews).toHaveBeenCalled()
    expect(syncComments).toHaveBeenCalled()
  })

  it('should return partial success when some syncers fail', async () => {
    vi.mocked(syncFiles).mockRejectedValue(new Error('Files failed'))

    const result = await syncPullRequestDetails({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(result.success).toEqual(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Files sync failed')
  })

  it('should handle all syncers failing', async () => {
    vi.mocked(syncChecks).mockRejectedValue(new Error('Checks error'))
    vi.mocked(syncCommits).mockRejectedValue(new Error('Commits error'))
    vi.mocked(syncFiles).mockRejectedValue(new Error('Files error'))
    vi.mocked(syncReviews).mockRejectedValue(new Error('Reviews error'))
    vi.mocked(syncComments).mockRejectedValue(new Error('Comments error'))

    const result = await syncPullRequestDetails({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(result.success).toEqual(false)
    expect(result.errors).toHaveLength(5)
  })

  it('should pass correct parameters to syncFiles', async () => {
    await syncPullRequestDetails({
      token: 'special-token',
      pullRequestId: 'pr-456',
      owner: 'myowner',
      repositoryName: 'myrepo',
      pullNumber: 42
    })

    expect(syncFiles).toHaveBeenCalledWith({
      token: 'special-token',
      pullRequestId: 'pr-456',
      owner: 'myowner',
      repositoryName: 'myrepo',
      pullNumber: 42
    })
  })

  it('should handle non-Error exceptions', async () => {
    vi.mocked(syncChecks).mockRejectedValue('String error')

    const result = await syncPullRequestDetails({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(result.success).toEqual(false)
    expect(result.errors[0]).toContain('Checks sync failed: String error')
  })
})
