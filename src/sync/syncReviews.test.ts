import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockRestReviewsResponse,
  mockRestReviewCommentsResponse
} from './test-helpers'
import { getDatabase } from '../database'
import { reviews, comments, commentReactions } from '../database/schema'
import { syncReviews } from './syncReviews'

const mockRequest = vi.fn()

vi.mock('./restClient', () => ({
  createRestClient: () => ({
    request: mockRequest
  })
}))

describe('syncReviews', () => {
  beforeEach(async () => {
    await setupTestDatabase()
    vi.clearAllMocks()
    mockRequest.mockReset()

    // Set up mock request to handle reviews, comments, and reactions requests
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/reviews')) {
        return Promise.resolve({
          data: mockRestReviewsResponse,
          notModified: false,
          etag: 'reviews-etag',
          lastModified: null
        })
      }

      if (route.includes('/pulls/comments/{comment_id}/reactions')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              node_id: 'reaction-1',
              content: '+1',
              user: { login: 'testuser', id: 1 }
            }
          ],
          notModified: false,
          etag: 'reactions-etag',
          lastModified: null
        })
      }

      if (route.includes('/comments')) {
        return Promise.resolve({
          data: mockRestReviewCommentsResponse,
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

  it('should sync reviews from GitHub response', async () => {
    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      expect.objectContaining({
        owner: 'testowner',
        repo: 'testrepo',
        pull_number: 1
      }),
      { etag: undefined }
    )

    const db = getDatabase()
    const savedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.pullRequestId, 'pr-123'))

    expect(savedReviews).toHaveLength(2)
  })

  it('should store review metadata correctly', async () => {
    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.pullRequestId, 'pr-123'))

    const approvedReview = savedReviews.find((r) => r.state === 'APPROVED')

    expect(approvedReview).toBeDefined()
    expect(approvedReview?.body).toEqual('Looks good!')
    expect(approvedReview?.authorLogin).toEqual('reviewer1')
  })

  it('should sync review comments', async () => {
    await syncReviews({
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

    const comment = savedComments.find((c) => c.body === 'Nice change here')

    expect(comment).toBeDefined()
    expect(comment?.path).toEqual('src/index.ts')
  })

  it('should sync comment reactions', async () => {
    await syncReviews({
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

    const reaction = savedReactions.find((r) => r.content === '+1')

    expect(reaction).toBeDefined()
    expect(reaction?.userLogin).toEqual('testuser')
  })

  it('should handle reviews without comments', async () => {
    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.pullRequestId, 'pr-123'))

    const changesRequestedReview = savedReviews.find(
      (r) => r.state === 'CHANGES_REQUESTED'
    )

    expect(changesRequestedReview).toBeDefined()
  })

  it('should soft delete reviews that no longer exist', async () => {
    const db = getDatabase()

    await db.insert(reviews).values({
      id: 'existing-1',
      gitHubId: 'deleted-review',
      pullRequestId: 'pr-123',
      state: 'PENDING',
      syncedAt: new Date().toISOString()
    })

    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const deletedReview = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, 'existing-1'))

    expect(deletedReview[0].deletedAt).not.toBeNull()

    const activeReviews = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.pullRequestId, 'pr-123'), isNull(reviews.deletedAt)))

    expect(activeReviews).toHaveLength(2)
  })

  it('should handle empty reviews response', async () => {
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/reviews')) {
        return Promise.resolve({
          data: [],
          notModified: false,
          etag: 'reviews-etag',
          lastModified: null
        })
      }

      if (route.includes('/comments')) {
        return Promise.resolve({
          data: [],
          notModified: false,
          etag: 'comments-etag',
          lastModified: null
        })
      }

      return Promise.resolve({ data: null, notModified: false, etag: null, lastModified: null })
    })

    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.pullRequestId, 'pr-123'))

    expect(savedReviews).toHaveLength(0)
  })

  it('should throw on API errors', async () => {
    mockRequest.mockRejectedValue(new Error('API error'))

    await expect(
      syncReviews({
        token: 'test-token',
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('API error')
  })

  it('should handle line type detection for added lines', async () => {
    mockRequest.mockImplementation((route: string) => {
      if (route.includes('/reviews')) {
        return Promise.resolve({
          data: [],
          notModified: false,
          etag: 'reviews-etag',
          lastModified: null
        })
      }

      if (route.includes('/comments')) {
        return Promise.resolve({
          data: [
            {
              id: 100,
              node_id: 'comment-add',
              pull_request_review_id: null,
              body: 'Comment on added line',
              path: 'file.ts',
              line: 10,
              original_line: 8,
              diff_hunk: '@@ -5,5 +5,10 @@\n+added line',
              commit_id: 'abc',
              original_commit_id: 'def',
              user: { login: 'user', avatar_url: 'https://avatar', id: 1 },
              html_url: 'https://github.com/comment',
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

    await syncReviews({
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
      .where(eq(comments.gitHubId, 'comment-add'))

    expect(savedComments[0].line).toEqual(10)
    expect(savedComments[0].originalLine).toBeNull()
  })

  it('should skip processing on 304 Not Modified for both endpoints', async () => {
    mockRequest.mockImplementation(() => {
      return Promise.resolve({
        data: null,
        notModified: true,
        etag: 'mock-etag',
        lastModified: null
      })
    })

    const db = getDatabase()

    await db.insert(reviews).values({
      id: 'existing-1',
      gitHubId: 'existing-review',
      pullRequestId: 'pr-123',
      state: 'APPROVED',
      syncedAt: new Date().toISOString()
    })

    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    // Review should not be deleted since we got 304
    const existingReview = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, 'existing-1'))

    expect(existingReview[0].deletedAt).toBeNull()
  })
})
