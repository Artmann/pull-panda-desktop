import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import { setupTestDatabase, teardownTestDatabase, mockReviewsResponse } from './test-helpers'
import { getDatabase } from '../database'
import { reviews, comments, commentReactions } from '../database/schema'
import { syncReviews } from './syncReviews'

describe('syncReviews', () => {
  beforeEach(() => {
    setupTestDatabase()
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync reviews from GitHub response', async () => {
    const mockClient = vi.fn().mockResolvedValue(mockReviewsResponse)

    await syncReviews({
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
    const savedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.pullRequestId, 'pr-123'))

    expect(savedReviews).toHaveLength(2)
  })

  it('should store review metadata correctly', async () => {
    const mockClient = vi.fn().mockResolvedValue(mockReviewsResponse)

    await syncReviews({
      client: mockClient,
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
    const mockClient = vi.fn().mockResolvedValue(mockReviewsResponse)

    await syncReviews({
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

    const comment = savedComments.find((c) => c.body === 'Nice change here')

    expect(comment).toBeDefined()
    expect(comment?.path).toEqual('src/index.ts')
  })

  it('should sync comment reactions', async () => {
    const mockClient = vi.fn().mockResolvedValue(mockReviewsResponse)

    await syncReviews({
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

    const reaction = savedReactions.find((r) => r.content === 'THUMBS_UP')

    expect(reaction).toBeDefined()
    expect(reaction?.userLogin).toEqual('testuser')
  })

  it('should handle reviews without comments', async () => {
    const mockClient = vi.fn().mockResolvedValue(mockReviewsResponse)

    await syncReviews({
      client: mockClient,
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

    const mockClient = vi.fn().mockResolvedValue(mockReviewsResponse)

    await syncReviews({
      client: mockClient,
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
    const emptyResponse = {
      repository: {
        pullRequest: {
          reviews: {
            nodes: []
          }
        }
      }
    }

    const mockClient = vi.fn().mockResolvedValue(emptyResponse)

    await syncReviews({
      client: mockClient,
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
    const mockClient = vi.fn().mockRejectedValue(new Error('API error'))

    await expect(
      syncReviews({
        client: mockClient,
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('API error')
  })

  it('should handle line type detection for added lines', async () => {
    const responseWithAddedLineComment = {
      repository: {
        pullRequest: {
          reviews: {
            nodes: [
              {
                id: 'review-add',
                body: '',
                createdAt: '2024-01-01T11:00:00Z',
                state: 'COMMENTED',
                submittedAt: '2024-01-01T11:00:00Z',
                url: 'https://github.com/review',
                author: { login: 'user', avatarUrl: 'https://avatar' },
                comments: {
                  nodes: [
                    {
                      id: 'comment-add',
                      body: 'Comment on added line',
                      createdAt: '2024-01-01T11:00:00Z',
                      updatedAt: '2024-01-01T11:00:00Z',
                      url: 'https://github.com/comment',
                      path: 'file.ts',
                      line: 10,
                      originalLine: 8,
                      diffHunk: '@@ -5,5 +5,10 @@\n+added line',
                      commit: { oid: 'abc' },
                      originalCommit: { oid: 'def' },
                      pullRequestReview: { id: 'review-add' },
                      replyTo: null,
                      author: { login: 'user', avatarUrl: 'https://avatar' },
                      reactions: { nodes: [] }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    }

    const mockClient = vi.fn().mockResolvedValue(responseWithAddedLineComment)

    await syncReviews({
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
      .where(eq(comments.gitHubId, 'comment-add'))

    expect(savedComments[0].line).toEqual(10)
    expect(savedComments[0].originalLine).toBeNull()
  })
})
