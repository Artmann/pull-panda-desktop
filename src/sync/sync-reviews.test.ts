import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockRestReviewsResponse,
  mockRestReviewCommentsResponse
} from './test-helpers'
import { getDatabase } from '../database'
import {
  reviews,
  reviewThreads,
  comments,
  commentReactions
} from '../database/schema'
import { syncReviews } from './sync-reviews'

const mockRequest = vi.fn()

vi.mock('./rest-client', () => ({
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
      .where(
        and(eq(reviews.pullRequestId, 'pr-123'), isNull(reviews.deletedAt))
      )

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

      return Promise.resolve({
        data: null,
        notModified: false,
        etag: null,
        lastModified: null
      })
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

      return Promise.resolve({
        data: null,
        notModified: false,
        etag: null,
        lastModified: null
      })
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

  it('should not soft-delete review comments when only review-comments endpoint returned 304', async () => {
    const db = getDatabase()

    // Seed an existing review comment that should survive the sync
    await db.insert(comments).values({
      id: 'existing-review-comment',
      gitHubId: 'review-comment-existing',
      gitHubNumericId: 999,
      pullRequestId: 'pr-123',
      reviewId: null,
      body: 'Pre-existing review comment',
      bodyHtml: null,
      path: 'src/file.ts',
      line: 10,
      originalLine: null,
      diffHunk: '@@ -1 +1 @@',
      commitId: 'abc',
      originalCommitId: 'def',
      gitHubReviewId: null,
      gitHubReviewThreadId: null,
      parentCommentGitHubId: null,
      userLogin: 'reviewer',
      userAvatarUrl: null,
      url: 'https://github.com/owner/repo/pull/1#discussion_r999',
      gitHubCreatedAt: '2024-01-01T11:00:00Z',
      gitHubUpdatedAt: '2024-01-01T11:00:00Z',
      syncedAt: new Date().toISOString()
    })

    mockRequest.mockImplementation((route: string) => {
      // Reviews returned new data
      if (route.includes('/reviews')) {
        return Promise.resolve({
          data: mockRestReviewsResponse,
          notModified: false,
          etag: 'reviews-etag-new',
          lastModified: null
        })
      }

      // Review comments returned 304 (unchanged)
      if (route.includes('/comments')) {
        return Promise.resolve({
          data: null,
          notModified: true,
          etag: 'comments-etag',
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

    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const reviewComment = await db
      .select()
      .from(comments)
      .where(eq(comments.id, 'existing-review-comment'))

    expect(reviewComment[0].deletedAt).toBeNull()
  })

  it('should invalidate the review-comments etag when the PR has orphan reviews', async () => {
    const db = getDatabase()
    const { etagManager } = await import('./etag-manager')

    // Cache a stale etag for review_comments — would normally yield 304
    etagManager.set(
      { endpointType: 'review_comments', resourceId: 'pr-123' },
      'stale-etag'
    )
    // Also cache the reviews etag so the orphan-recovery condition can fire
    etagManager.set(
      { endpointType: 'reviews', resourceId: 'pr-123' },
      'stale-reviews-etag'
    )

    // Seed a review and a review_thread but zero review comments — the
    // signature of the previous bug that soft-deleted comments while leaving
    // their threads behind.
    await db.insert(reviews).values({
      id: 'orphan-review',
      gitHubId: 'orphan-review-gh',
      gitHubNumericId: 42,
      pullRequestId: 'pr-123',
      state: 'APPROVED',
      body: 'lgtm',
      syncedAt: new Date().toISOString()
    })

    await db.insert(reviewThreads).values({
      id: 'orphan-thread',
      gitHubId: 'orphan-thread-gh',
      pullRequestId: 'pr-123',
      isResolved: false,
      syncedAt: new Date().toISOString()
    })

    let receivedCommentsEtag: string | undefined = 'unset'

    mockRequest.mockImplementation(
      (route: string, _params: unknown, options?: { etag?: string }) => {
        if (route.includes('/reviews')) {
          return Promise.resolve({
            data: mockRestReviewsResponse,
            notModified: false,
            etag: 'reviews-etag-fresh',
            lastModified: null
          })
        }

        if (route.includes('/pulls/comments/{comment_id}/reactions')) {
          return Promise.resolve({
            data: [],
            notModified: false,
            etag: null,
            lastModified: null
          })
        }

        if (route.includes('/comments')) {
          receivedCommentsEtag = options?.etag

          return Promise.resolve({
            data: mockRestReviewCommentsResponse,
            notModified: false,
            etag: 'comments-etag-fresh',
            lastModified: null
          })
        }

        return Promise.resolve({
          data: null,
          notModified: false,
          etag: null,
          lastModified: null
        })
      }
    )

    await syncReviews({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    // Stale etag should have been cleared before the comments request
    expect(receivedCommentsEtag).toBeUndefined()

    // Review comments should now be in the DB
    const restoredComments = await db
      .select()
      .from(comments)
      .where(
        and(eq(comments.pullRequestId, 'pr-123'), isNull(comments.deletedAt))
      )

    expect(
      restoredComments.find((c) => c.path === 'src/index.ts')
    ).toBeDefined()
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
