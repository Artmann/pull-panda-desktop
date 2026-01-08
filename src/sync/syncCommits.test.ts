import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockCommitsResponse,
  createMockGraphqlClientWithResponse,
  createMockGraphqlClientWithError
} from './test-helpers'
import { getDatabase } from '../database'
import { commits } from '../database/schema'
import { syncCommits } from './syncCommits'

describe('syncCommits', () => {
  beforeEach(() => {
    setupTestDatabase()
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync commits from GitHub response', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommitsResponse)

    await syncCommits({
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
    const savedCommits = await db
      .select()
      .from(commits)
      .where(eq(commits.pullRequestId, 'pr-123'))

    expect(savedCommits).toHaveLength(2)
  })

  it('should normalize commit messages', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommitsResponse)

    await syncCommits({
      client: mockClient,
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

    const commitWithMultipleLines = savedCommits.find((c) => c.hash === 'commit-2')

    expect(commitWithMultipleLines?.message).toEqual('Add feature\n\nWith description')
  })

  it('should extract author login from user object', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommitsResponse)

    await syncCommits({
      client: mockClient,
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

  it('should fall back to author name if user login not available', async () => {
    const responseWithoutUserLogin = {
      repository: {
        pullRequest: {
          commits: {
            nodes: [
              {
                commit: {
                  oid: 'commit-no-user',
                  message: 'Commit without user',
                  url: 'https://github.com/commit',
                  additions: 5,
                  deletions: 2,
                  authoredDate: '2024-01-01T09:00:00Z',
                  author: {
                    name: 'Bot User',
                    avatarUrl: 'https://avatars.githubusercontent.com/u/0',
                    user: null as null
                  }
                }
              }
            ]
          }
        }
      }
    }

    const mockClient = createMockGraphqlClientWithResponse(responseWithoutUserLogin)

    await syncCommits({
      client: mockClient,
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

    expect(savedCommits[0].authorLogin).toEqual('Bot User')
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

    const mockClient = createMockGraphqlClientWithResponse(mockCommitsResponse)

    await syncCommits({
      client: mockClient,
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
      .where(and(eq(commits.pullRequestId, 'pr-123'), isNull(commits.deletedAt)))

    expect(activeCommits).toHaveLength(2)
  })

  it('should store line statistics', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommitsResponse)

    await syncCommits({
      client: mockClient,
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

    expect(firstCommit?.linesAdded).toEqual(100)
    expect(firstCommit?.linesRemoved).toEqual(50)
  })

  it('should handle empty commits response', async () => {
    const emptyResponse = {
      repository: {
        pullRequest: {
          commits: {
            nodes: [] as unknown[]
          }
        }
      }
    }

    const mockClient = createMockGraphqlClientWithResponse(emptyResponse)

    await syncCommits({
      client: mockClient,
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

    expect(savedCommits).toHaveLength(0)
  })

  it('should throw on API errors', async () => {
    const mockClient = createMockGraphqlClientWithError(new Error('API error'))

    await expect(
      syncCommits({
        client: mockClient,
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('API error')
  })
})
