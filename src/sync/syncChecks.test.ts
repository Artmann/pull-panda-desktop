import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import { setupTestDatabase, teardownTestDatabase, mockChecksResponse } from './test-helpers'
import { getDatabase } from '../database'
import { checks } from '../database/schema'
import { syncChecks } from './syncChecks'

describe('syncChecks', () => {
  beforeEach(() => {
    setupTestDatabase()
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync checks from GitHub response', async () => {
    const mockClient = vi.fn().mockResolvedValue(mockChecksResponse)

    await syncChecks({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(mockClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        owner: 'testowner',
        repo: 'testrepo',
        pullNumber: 1
      })
    )

    const db = getDatabase()
    const savedChecks = await db
      .select()
      .from(checks)
      .where(eq(checks.pullRequestId, 'pr-123'))

    expect(savedChecks).toHaveLength(2)
  })

  it('should calculate duration in seconds', async () => {
    const mockClient = vi.fn().mockResolvedValue(mockChecksResponse)

    await syncChecks({
      client: mockClient,
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

  it('should skip non-CheckRun types', async () => {
    const responseWithStatusContext = {
      repository: {
        pullRequest: {
          commits: {
            nodes: [
              {
                commit: {
                  oid: 'abc123',
                  statusCheckRollup: {
                    contexts: {
                      nodes: [
                        {
                          __typename: 'StatusContext',
                          id: 'status-1',
                          context: 'ci/jenkins',
                          state: 'SUCCESS'
                        }
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }

    const mockClient = vi.fn().mockResolvedValue(responseWithStatusContext)

    await syncChecks({
      client: mockClient,
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

    const mockClient = vi.fn().mockResolvedValue(mockChecksResponse)

    await syncChecks({
      client: mockClient,
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
    const mockClient = vi.fn().mockRejectedValue(
      new Error('Resource not accessible by integration')
    )

    await expect(
      syncChecks({
        client: mockClient,
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).resolves.not.toThrow()
  })

  it('should throw non-permission errors', async () => {
    const mockClient = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(
      syncChecks({
        client: mockClient,
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('Network error')
  })

  it('should handle empty checks response', async () => {
    const emptyResponse = {
      repository: {
        pullRequest: {
          commits: {
            nodes: []
          }
        }
      }
    }

    const mockClient = vi.fn().mockResolvedValue(emptyResponse)

    await syncChecks({
      client: mockClient,
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
    const mockClient = vi.fn().mockResolvedValue(mockChecksResponse)

    await syncChecks({
      client: mockClient,
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
        gitHubId: 'check-1',
        pullRequestId: 'pr-123',
        name: 'build',
        conclusion: 'SUCCESS',
        state: 'COMPLETED',
        suiteName: 'CI',
        commitSha: 'abc123'
      })
    )
  })
})
