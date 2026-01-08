import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockRestIssueCommentsResponse
} from './test-helpers'
import { getDatabase } from '../database'
import { comments, commentReactions } from '../database/schema'
import { syncComments } from './syncComments'

const mockRequest = vi.fn()

vi.mock('./restClient', () => ({
  createRestClient: () => ({
    request: mockRequest
  })
}))

describe('syncComments', () => {
  beforeEach(async () => {
    await setupTestDatabase()
    vi.clearAllMocks()
    mockRequest.mockReset()

    // Set up mock request to handle issue comments and reactions requests
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/issues/comments/{comment_id}/reactions')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              node_id: 'reaction-1',
              content: 'heart',
              user: { login: 'liker', id: 1 }
            }
          ],
          notModified: false,
          etag: 'reactions-etag',
          lastModified: null
        })
      }

      if (route.includes('/comments')) {
        return Promise.resolve({
          data: mockRestIssueCommentsResponse,
          notModified: false,
          etag: 'comments-etag',
          lastModified: null
        })
      }

      return Promise.resolve({ data: null, notModified: false, etag: null, lastModified: null })
    })
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync comments from GitHub response', async () => {
    await syncComments({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
      expect.objectContaining({
        owner: 'testowner',
        repo: 'testrepo',
        issue_number: 1
      }),
      { etag: undefined }
    )

    const db = getDatabase()
    const savedComments = await db
      .select()
      .from(comments)
      .where(eq(comments.pullRequestId, 'pr-123'))

    expect(savedComments).toHaveLength(1)
  })

  it('should sync PR-level comments', async () => {
    await syncComments({
      token: 'test-token',
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

  it('should sync comment reactions', async () => {
    await syncComments({
      token: 'test-token',
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

    const reaction = savedReactions.find((r) => r.content === 'heart')

    expect(reaction).toBeDefined()
    expect(reaction?.userLogin).toEqual('liker')
  })

  it('should soft delete comments that no longer exist', async () => {
    const db = getDatabase()

    // Insert an issue comment (path = null)
    await db.insert(comments).values({
      id: 'existing-1',
      gitHubId: 'deleted-comment',
      pullRequestId: 'pr-123',
      path: null,
      syncedAt: new Date().toISOString()
    })

    await syncComments({
      token: 'test-token',
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

    expect(activeComments).toHaveLength(1)
  })

  it('should handle empty comments response', async () => {
    mockRequest.mockImplementation(() => {
      return Promise.resolve({
        data: [],
        notModified: false,
        etag: 'comments-etag',
        lastModified: null
      })
    })

    await syncComments({
      token: 'test-token',
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
    mockRequest.mockRejectedValue(new Error('API error'))

    await expect(
      syncComments({
        token: 'test-token',
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('API error')
  })

  it('should normalize comment body', async () => {
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/comments')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              node_id: 'comment-crlf',
              body: 'Line 1\r\n\r\n\r\n\r\nLine 2',
              html_url: 'https://github.com/comment',
              user: { login: 'user', avatar_url: 'https://avatar', id: 1 },
              created_at: '2024-01-01T11:00:00Z',
              updated_at: '2024-01-01T11:00:00Z'
            }
          ],
          notModified: false,
          etag: 'comments-etag',
          lastModified: null
        })
      }

      return Promise.resolve({ data: null, notModified: false, etag: null, lastModified: null })
    })

    await syncComments({
      token: 'test-token',
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

  it('should skip processing on 304 Not Modified', async () => {
    mockRequest.mockImplementation(() => {
      return Promise.resolve({
        data: null,
        notModified: true,
        etag: 'mock-etag',
        lastModified: null
      })
    })

    const db = getDatabase()

    await db.insert(comments).values({
      id: 'existing-1',
      gitHubId: 'existing-comment',
      pullRequestId: 'pr-123',
      path: null,
      syncedAt: new Date().toISOString()
    })

    await syncComments({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    // Comment should not be deleted since we got 304
    const existingComment = await db
      .select()
      .from(comments)
      .where(eq(comments.id, 'existing-1'))

    expect(existingComment[0].deletedAt).toBeNull()
  })
})
