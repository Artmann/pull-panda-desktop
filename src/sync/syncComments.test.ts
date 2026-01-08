import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockCommentsResponse,
  createMockGraphqlClientWithResponse,
  createMockGraphqlClientWithError
} from './test-helpers'
import { getDatabase } from '../database'
import { comments, commentReactions } from '../database/schema'
import { syncComments } from './syncComments'

describe('syncComments', () => {
  beforeEach(() => {
    setupTestDatabase()
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync comments from GitHub response', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommentsResponse)

    await syncComments({
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
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.pullRequestId, 'pr-123'))

    expect(savedComments).toHaveLength(3)
  })

  it('should sync PR-level comments', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommentsResponse)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.pullRequestId, 'pr-123'))

    const prComment = savedComments.find(
      (c) => c.body === 'This is a PR-level comment'
    )

    expect(prComment).toBeDefined()
    expect(prComment?.userLogin).toEqual('commenter1')
    expect(prComment?.path).toBeNull()
  })

  it('should sync review thread comments', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommentsResponse)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.pullRequestId, 'pr-123'))

    const threadComment = savedComments.find(
      (c) => c.body === 'This needs refactoring'
    )

    expect(threadComment).toBeDefined()
    expect(threadComment?.path).toEqual('src/utils.ts')
    expect(threadComment?.gitHubReviewThreadId).toEqual('thread-1')
  })

  it('should track reply relationships', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommentsResponse)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.pullRequestId, 'pr-123'))

    const replyComment = savedComments.find((c) => c.body === 'I agree, will fix')

    expect(replyComment).toBeDefined()
    expect(replyComment?.parentCommentGitHubId).toEqual('thread-comment-1')
  })

  it('should sync comment reactions', async () => {
    const mockClient = createMockGraphqlClientWithResponse(mockCommentsResponse)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedReactions = await db
      .select()
      .from(commentReactions)
      .where(eq(commentReactions.pullRequestId, 'pr-123'))

    const reaction = savedReactions.find((r) => r.content === 'HEART')

    expect(reaction).toBeDefined()
    expect(reaction?.userLogin).toEqual('liker')
  })

  it('should soft delete comments that no longer exist', async () => {
    const db = getDatabase()

    await db.insert(comments).values({
      id: 'existing-1',
      gitHubId: 'deleted-comment',
      pullRequestId: 'pr-123',
      syncedAt: new Date().toISOString()
    })

    const mockClient = createMockGraphqlClientWithResponse(mockCommentsResponse)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const deletedComment = await db
      .select()
      .from(comments)
      .where(eq(comments.id, 'existing-1'))

    expect(deletedComment[0].deletedAt).not.toBeNull()

    const activeComments = await db
      .select()
      .from(comments)
      .where(and(eq(comments.pullRequestId, 'pr-123'), isNull(comments.deletedAt)))

    expect(activeComments).toHaveLength(3)
  })

  it('should handle empty comments response', async () => {
    const emptyResponse = {
      repository: {
        pullRequest: {
          comments: {
            nodes: [] as unknown[]
          },
          reviewThreads: {
            nodes: [] as unknown[]
          }
        }
      }
    }

    const mockClient = createMockGraphqlClientWithResponse(emptyResponse)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.pullRequestId, 'pr-123'))

    expect(savedComments).toHaveLength(0)
  })

  it('should throw on API errors', async () => {
    const mockClient = createMockGraphqlClientWithError(new Error('API error'))

    await expect(
      syncComments({
        client: mockClient,
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('API error')
  })

  it('should handle line type detection for removed lines', async () => {
    const responseWithRemovedLineComment = {
      repository: {
        pullRequest: {
          comments: { nodes: [] as unknown[] },
          reviewThreads: {
            nodes: [
              {
                id: 'thread-remove',
                comments: {
                  nodes: [
                    {
                      id: 'comment-remove',
                      body: 'Comment on removed line',
                      createdAt: '2024-01-01T11:00:00Z',
                      updatedAt: '2024-01-01T11:00:00Z',
                      url: 'https://github.com/comment',
                      path: 'file.ts',
                      line: 10,
                      originalLine: 8,
                      diffHunk: '@@ -5,10 +5,5 @@\n-removed line',
                      commit: { oid: 'abc' },
                      originalCommit: { oid: 'def' },
                      pullRequestReview: null as null,
                      replyTo: null as null,
                      author: { login: 'user', avatarUrl: 'https://avatar' },
                      reactions: { nodes: [] as unknown[] }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    }

    const mockClient = createMockGraphqlClientWithResponse(responseWithRemovedLineComment)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.gitHubId, 'comment-remove'))

    expect(savedComments[0].line).toBeNull()
    expect(savedComments[0].originalLine).toEqual(8)
  })

  it('should normalize comment body', async () => {
    const responseWithWindowsLineEndings = {
      repository: {
        pullRequest: {
          comments: {
            nodes: [
              {
                id: 'comment-crlf',
                body: 'Line 1\r\n\r\n\r\n\r\nLine 2',
                createdAt: '2024-01-01T11:00:00Z',
                updatedAt: '2024-01-01T11:00:00Z',
                url: 'https://github.com/comment',
                author: { login: 'user', avatarUrl: 'https://avatar' },
                reactions: { nodes: [] as unknown[] }
              }
            ]
          },
          reviewThreads: { nodes: [] as unknown[] }
        }
      }
    }

    const mockClient = createMockGraphqlClientWithResponse(responseWithWindowsLineEndings)

    await syncComments({
      client: mockClient,
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.gitHubId, 'comment-crlf'))

    expect(savedComments[0].body).toEqual('Line 1\n\nLine 2')
  })
})
