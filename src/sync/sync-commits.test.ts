import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockRestCommitsResponse
} from './test-helpers'
import { getDatabase } from '../database'
import { commits } from '../database/schema'
import { syncCommits } from './sync-commits'

const mockRequest = vi.fn()

vi.mock('./rest-client', () => ({
  createRestClient: () => ({
    request: mockRequest
  })
}))

describe('syncCommits', () => {
  beforeEach(async () => {
    await setupTestDatabase()
    vi.clearAllMocks()
    mockRequest.mockReset()
    mockRequest.mockResolvedValue({
      data: mockRestCommitsResponse.data,
      notModified: false,
      etag: 'mock-etag',
      lastModified: null
    })
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync commits from GitHub REST API response', async () => {
    await syncCommits({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedCommits = await db
      .select()
      .from(commits)
      .where(eq(commits.pullRequestId, 'pr-123'))

    expect(savedCommits).toHaveLength(2)
  })

  it('should normalize commit messages', async () => {
    await syncCommits({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedCommits = await db
      .select()
      .from(commits)
      .where(eq(commits.pullRequestId, 'pr-123'))

    const commitWithMultipleLines = savedCommits.find(
      (c) => c.hash === 'commit-2'
    )

    expect(commitWithMultipleLines?.message).toEqual(
      'Add feature\n\nWith description'
    )
  })

  it('should extract author login from REST API response', async () => {
    await syncCommits({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedCommits = await db
      .select()
      .from(commits)
      .where(eq(commits.pullRequestId, 'pr-123'))

    const firstCommit = savedCommits.find((c) => c.hash === 'commit-1')

    expect(firstCommit?.authorLogin).toEqual('testuser')
  })

  it('should soft delete commits that no longer exist', async () => {
    const db = getDatabase()

    await db.insert(commits).values({
      id: 'existing-1',
      gitHubId: 'deleted-commit',
      pullRequestId: 'pr-123',
      hash: 'deleted-hash',
      syncedAt: new Date().toISOString()
    })

    await syncCommits({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const deletedCommit = await db
      .select()
      .from(commits)
      .where(eq(commits.id, 'existing-1'))

    expect(deletedCommit[0].deletedAt).not.toBeNull()

    const activeCommits = await db
      .select()
      .from(commits)
      .where(
        and(eq(commits.pullRequestId, 'pr-123'), isNull(commits.deletedAt))
      )

    expect(activeCommits).toHaveLength(2)
  })

  it('should handle empty commits response', async () => {
    mockRequest.mockResolvedValueOnce({
      data: [],
      notModified: false,
      etag: 'mock-etag',
      lastModified: null
    })

    await syncCommits({
      token: 'test-token',
      pullRequestId: 'pr-empty',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedCommits = await db
      .select()
      .from(commits)
      .where(eq(commits.pullRequestId, 'pr-empty'))

    expect(savedCommits).toHaveLength(0)
  })

  it('should throw on non-rate-limit API errors', async () => {
    mockRequest.mockRejectedValueOnce(new Error('API error'))

    await expect(
      syncCommits({
        token: 'test-token',
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('API error')
  })

  it('should skip processing on 304 Not Modified', async () => {
    mockRequest.mockResolvedValueOnce({
      data: null,
      notModified: true,
      etag: 'mock-etag',
      lastModified: null
    })

    const db = getDatabase()

    await db.insert(commits).values({
      id: 'existing-1',
      gitHubId: 'existing-commit',
      pullRequestId: 'pr-123',
      hash: 'existing-hash',
      syncedAt: new Date().toISOString()
    })

    await syncCommits({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    // Commit should not be deleted since we got 304
    const existingCommit = await db
      .select()
      .from(commits)
      .where(eq(commits.id, 'existing-1'))

    expect(existingCommit[0].deletedAt).toBeNull()
  })
})
