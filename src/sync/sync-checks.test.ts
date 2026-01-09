import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockRestCheckRunsResponse
} from './test-helpers'
import { getDatabase } from '../database'
import { checks } from '../database/schema'
import { syncChecks } from './sync-checks'

const mockRequest = vi.fn()

vi.mock('./rest-client', () => ({
  createRestClient: () => ({
    request: mockRequest
  })
}))

const mockPullRequestResponse = {
  data: {
    head: {
      sha: 'abc123'
    }
  },
  notModified: false,
  etag: 'pr-etag',
  lastModified: null as string | null
}

describe('syncChecks', () => {
  beforeEach(async () => {
    await setupTestDatabase()
    vi.clearAllMocks()
    mockRequest.mockReset()

    // Set up mock request to handle both PR and checks requests
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/pulls/')) {
        return Promise.resolve(mockPullRequestResponse)
      }

      if (route.includes('/check-runs')) {
        return Promise.resolve({
          data: mockRestCheckRunsResponse,
          notModified: false,
          etag: 'checks-etag',
          lastModified: null
        })
      }

      return Promise.resolve({
        data: null,
        notModified: false,
        etag: null,
        lastModified: null
      })
    })
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync checks from GitHub response', async () => {
    await syncChecks({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner: 'testowner',
        repo: 'testrepo',
        pull_number: 1
      },
      { etag: undefined }
    )

    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
      {
        owner: 'testowner',
        repo: 'testrepo',
        ref: 'abc123',
        per_page: 100
      },
      { etag: undefined }
    )

    const db = getDatabase()
    const savedChecks = await db
      .select()
      .from(checks)
      .where(eq(checks.pullRequestId, 'pr-123'))

    expect(savedChecks).toHaveLength(2)
  })

  it('should calculate duration in seconds', async () => {
    await syncChecks({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedChecks = await db
      .select()
      .from(checks)
      .where(eq(checks.pullRequestId, 'pr-123'))

    const buildCheck = savedChecks.find((c) => c.name === 'build')
    const testCheck = savedChecks.find((c) => c.name === 'test')

    expect(buildCheck?.durationInSeconds).toEqual(300)
    expect(testCheck?.durationInSeconds).toEqual(600)
  })

  it('should soft delete checks that no longer exist', async () => {
    const db = getDatabase()

    await db.insert(checks).values({
      id: 'existing-1',
      gitHubId: 'old-check',
      pullRequestId: 'pr-123',
      name: 'lint',
      commitSha: 'abc',
      syncedAt: new Date().toISOString()
    })

    await syncChecks({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const deletedCheck = await db
      .select()
      .from(checks)
      .where(eq(checks.id, 'existing-1'))

    expect(deletedCheck[0].deletedAt).not.toBeNull()

    const activeChecks = await db
      .select()
      .from(checks)
      .where(and(eq(checks.pullRequestId, 'pr-123'), isNull(checks.deletedAt)))

    expect(activeChecks).toHaveLength(2)
  })

  it('should handle permission errors gracefully', async () => {
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/pulls/')) {
        return Promise.resolve(mockPullRequestResponse)
      }

      if (route.includes('/check-runs')) {
        return Promise.reject(
          new Error('Resource not accessible by integration')
        )
      }

      return Promise.resolve({
        data: null,
        notModified: false,
        etag: null,
        lastModified: null
      })
    })

    await expect(
      syncChecks({
        token: 'test-token',
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).resolves.not.toThrow()
  })

  it('should throw non-permission errors', async () => {
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/pulls/')) {
        return Promise.resolve(mockPullRequestResponse)
      }

      if (route.includes('/check-runs')) {
        return Promise.reject(new Error('Network error'))
      }

      return Promise.resolve({
        data: null,
        notModified: false,
        etag: null,
        lastModified: null
      })
    })

    await expect(
      syncChecks({
        token: 'test-token',
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('Network error')
  })

  it('should handle empty checks response', async () => {
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/pulls/')) {
        return Promise.resolve(mockPullRequestResponse)
      }

      if (route.includes('/check-runs')) {
        return Promise.resolve({
          data: { total_count: 0, check_runs: [] },
          notModified: false,
          etag: 'checks-etag',
          lastModified: null
        })
      }

      return Promise.resolve({
        data: null,
        notModified: false,
        etag: null,
        lastModified: null
      })
    })

    await syncChecks({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedChecks = await db
      .select()
      .from(checks)
      .where(eq(checks.pullRequestId, 'pr-123'))

    expect(savedChecks).toHaveLength(0)
  })

  it('should store check metadata correctly', async () => {
    await syncChecks({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedChecks = await db
      .select()
      .from(checks)
      .where(eq(checks.pullRequestId, 'pr-123'))

    const buildCheck = savedChecks.find((c) => c.name === 'build')

    expect(buildCheck).toEqual(
      expect.objectContaining({
        gitHubId: '1',
        pullRequestId: 'pr-123',
        name: 'build',
        conclusion: 'success',
        state: 'completed',
        suiteName: 'GitHub Actions',
        commitSha: 'abc123'
      })
    )
  })

  it('should skip processing on 304 Not Modified', async () => {
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/pulls/')) {
        return Promise.resolve(mockPullRequestResponse)
      }

      if (route.includes('/check-runs')) {
        return Promise.resolve({
          data: null,
          notModified: true,
          etag: 'checks-etag',
          lastModified: null
        })
      }

      return Promise.resolve({
        data: null,
        notModified: false,
        etag: null,
        lastModified: null
      })
    })

    const db = getDatabase()

    await db.insert(checks).values({
      id: 'existing-1',
      gitHubId: 'existing-check',
      pullRequestId: 'pr-123',
      name: 'lint',
      commitSha: 'abc123',
      syncedAt: new Date().toISOString()
    })

    await syncChecks({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    // Check should not be deleted since we got 304
    const existingCheck = await db
      .select()
      .from(checks)
      .where(eq(checks.id, 'existing-1'))

    expect(existingCheck[0].deletedAt).toBeNull()
  })
})
