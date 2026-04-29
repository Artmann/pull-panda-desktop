import { eq, and, isNotNull, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import {
  reviews,
  reviewThreads,
  comments,
  commentReactions,
  type NewReview,
  type NewComment,
  type NewCommentReaction
} from '../database/schema'

import { createRestClient, type RestClient } from './rest-client'
import { etagManager } from './etag-manager'
import {
  generateId,
  normalizeCommentBody,
  getLineTypeFromDiffHunk
} from './utils'

interface SyncReviewsParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

interface ReviewData {
  id: number
  node_id: string
  state: string
  body: string | null
  body_html?: string
  html_url: string
  user: {
    login: string
    avatar_url: string
  } | null
  submitted_at: string | null
  commit_id: string
}

interface ReviewCommentData {
  id: number
  node_id: string
  pull_request_review_id: number | null
  body: string
  body_html?: string
  path: string
  line: number | null
  original_line: number | null
  diff_hunk: string
  commit_id: string
  original_commit_id: string
  in_reply_to_id?: number
  user: {
    login: string
    avatar_url: string
    id: number
  } | null
  html_url: string
  created_at: string
  updated_at: string
  reactions?: {
    url: string
    total_count: number
  }
}

interface ReactionData {
  id: number
  node_id: string
  content: string
  user: {
    login: string
    id: number
  } | null
}

function buildReview(
  reviewData: ReviewData,
  existingId: string | undefined,
  pullRequestId: string,
  now: string
): NewReview {
  return {
    id: existingId ?? generateId(),
    gitHubId: reviewData.node_id,
    gitHubNumericId: reviewData.id,
    pullRequestId,
    state: reviewData.state,
    body: reviewData.body ? normalizeCommentBody(reviewData.body) : null,
    bodyHtml: reviewData.body_html ?? null,
    url: reviewData.html_url,
    authorLogin: reviewData.user?.login ?? null,
    authorAvatarUrl: reviewData.user?.avatar_url ?? null,
    gitHubCreatedAt: reviewData.submitted_at,
    gitHubSubmittedAt: reviewData.submitted_at,
    syncedAt: now,
    deletedAt: null
  }
}

function upsertReviews(
  reviewsData: ReviewData[],
  pullRequestId: string,
  now: string
): Map<number, string> {
  const database = getDatabase()

  const existingReviews = database
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.pullRequestId, pullRequestId), isNull(reviews.deletedAt))
    )
    .all()

  const syncedReviewGitHubIds: string[] = []
  const reviewIdMap = new Map<number, string>()

  for (const reviewData of reviewsData) {
    syncedReviewGitHubIds.push(reviewData.node_id)

    const existingReview = existingReviews.find(
      (r) => r.gitHubId === reviewData.node_id
    )

    const review = buildReview(
      reviewData,
      existingReview?.id,
      pullRequestId,
      now
    )
    reviewIdMap.set(reviewData.id, review.id)

    database
      .insert(reviews)
      .values(review)
      .onConflictDoUpdate({
        target: reviews.id,
        set: {
          gitHubNumericId: review.gitHubNumericId,
          state: review.state,
          body: review.body,
          bodyHtml: review.bodyHtml,
          url: review.url,
          authorLogin: review.authorLogin,
          authorAvatarUrl: review.authorAvatarUrl,
          gitHubCreatedAt: review.gitHubCreatedAt,
          gitHubSubmittedAt: review.gitHubSubmittedAt,
          syncedAt: review.syncedAt,
          deletedAt: null
        }
      })
      .run()
  }

  for (const existingReview of existingReviews) {
    if (!syncedReviewGitHubIds.includes(existingReview.gitHubId)) {
      database
        .update(reviews)
        .set({ deletedAt: now })
        .where(eq(reviews.id, existingReview.id))
        .run()
    }
  }

  return reviewIdMap
}

function hasOrphanReviews(pullRequestId: string): boolean {
  const database = getDatabase()

  // GitHub creates a review_thread for every inline review comment, so a
  // stored thread is a strong signal that at least one review comment must
  // exist on GitHub. If we have threads but no local review comments, we lost
  // them (e.g. via the previous review-comments soft-delete bug) and should
  // refetch.
  const localReviewThreadCount = database
    .select()
    .from(reviewThreads)
    .where(
      and(
        eq(reviewThreads.pullRequestId, pullRequestId),
        isNull(reviewThreads.deletedAt)
      )
    )
    .all().length

  if (localReviewThreadCount === 0) {
    return false
  }

  const localReviewCommentCount = database
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.pullRequestId, pullRequestId),
        isNull(comments.deletedAt),
        isNotNull(comments.path)
      )
    )
    .all().length

  return localReviewCommentCount === 0
}

function buildReviewIdMapFromExisting(
  pullRequestId: string
): Map<number, string> {
  const database = getDatabase()

  const existingReviews = database
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.pullRequestId, pullRequestId), isNull(reviews.deletedAt))
    )
    .all()

  const reviewIdMap = new Map<number, string>()

  for (const review of existingReviews) {
    reviewIdMap.set(review.gitHubNumericId, review.id)
  }

  return reviewIdMap
}

function resolveCommentLine(commentData: ReviewCommentData): {
  line: number | null
  originalLine: number | null
} {
  const lineType = getLineTypeFromDiffHunk(commentData.diff_hunk ?? '')

  if (lineType === 'remove') {
    return { line: null, originalLine: commentData.original_line }
  }

  if (lineType === 'add') {
    return { line: commentData.line, originalLine: null }
  }

  return {
    line: commentData.line,
    originalLine: commentData.original_line
  }
}

function resolveParentCommentGitHubId(
  commentData: ReviewCommentData,
  commentsData: ReviewCommentData[]
): string | null {
  if (!commentData.in_reply_to_id) {
    return null
  }

  const parentComment = commentsData.find(
    (c) => c.id === commentData.in_reply_to_id
  )

  return parentComment?.node_id ?? null
}

function buildComment(
  commentData: ReviewCommentData,
  existingId: string | undefined,
  reviewId: string | null,
  parentCommentGitHubId: string | null,
  pullRequestId: string,
  now: string
): NewComment {
  const { line, originalLine } = resolveCommentLine(commentData)

  return {
    id: existingId ?? generateId(),
    gitHubId: commentData.node_id,
    gitHubNumericId: commentData.id,
    pullRequestId,
    reviewId,
    body: normalizeCommentBody(commentData.body),
    bodyHtml: commentData.body_html ?? null,
    path: commentData.path,
    line,
    originalLine,
    diffHunk: commentData.diff_hunk,
    commitId: commentData.commit_id,
    originalCommitId: commentData.original_commit_id,
    gitHubReviewId: commentData.pull_request_review_id
      ? String(commentData.pull_request_review_id)
      : null,
    gitHubReviewThreadId: null,
    parentCommentGitHubId,
    userLogin: commentData.user?.login ?? null,
    userAvatarUrl: commentData.user?.avatar_url ?? null,
    url: commentData.html_url,
    gitHubCreatedAt: commentData.created_at,
    gitHubUpdatedAt: commentData.updated_at,
    syncedAt: now,
    deletedAt: null
  }
}

async function syncCommentReactions(
  client: RestClient,
  commentData: ReviewCommentData,
  commentId: string,
  pullRequestId: string,
  owner: string,
  repositoryName: string,
  now: string
): Promise<void> {
  if (!commentData.reactions || commentData.reactions.total_count === 0) {
    return
  }

  const database = getDatabase()

  const reactionsResult = await client.request<ReactionData[]>(
    'GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions',
    {
      owner,
      repo: repositoryName,
      comment_id: commentData.id
    }
  )

  const reactionsData = reactionsResult.data ?? []

  for (const reactionData of reactionsData) {
    if (!reactionData.user) {
      continue
    }

    const existingReaction = database
      .select()
      .from(commentReactions)
      .where(eq(commentReactions.gitHubId, reactionData.node_id))
      .get()

    const reaction: NewCommentReaction = {
      id: existingReaction?.id ?? generateId(),
      gitHubId: reactionData.node_id,
      commentId,
      pullRequestId,
      content: reactionData.content,
      userLogin: reactionData.user.login,
      userId: String(reactionData.user.id),
      syncedAt: now,
      deletedAt: null
    }

    database
      .insert(commentReactions)
      .values(reaction)
      .onConflictDoUpdate({
        target: commentReactions.id,
        set: {
          content: reaction.content,
          userLogin: reaction.userLogin,
          userId: reaction.userId,
          syncedAt: reaction.syncedAt,
          deletedAt: null
        }
      })
      .run()
  }
}

async function upsertReviewComments(
  client: RestClient,
  commentsData: ReviewCommentData[],
  reviewIdMap: Map<number, string>,
  pullRequestId: string,
  owner: string,
  repositoryName: string,
  now: string
): Promise<void> {
  const database = getDatabase()

  const existingComments = database
    .select()
    .from(comments)
    .where(
      and(eq(comments.pullRequestId, pullRequestId), isNull(comments.deletedAt))
    )
    .all()

  const syncedCommentGitHubIds: string[] = []

  for (const commentData of commentsData) {
    syncedCommentGitHubIds.push(commentData.node_id)

    const existingComment = existingComments.find(
      (c) => c.gitHubId === commentData.node_id
    )

    const reviewId = commentData.pull_request_review_id
      ? (reviewIdMap.get(commentData.pull_request_review_id) ?? null)
      : null

    const parentCommentGitHubId = resolveParentCommentGitHubId(
      commentData,
      commentsData
    )

    const comment = buildComment(
      commentData,
      existingComment?.id,
      reviewId,
      parentCommentGitHubId,
      pullRequestId,
      now
    )

    database
      .insert(comments)
      .values(comment)
      .onConflictDoUpdate({
        target: comments.id,
        set: {
          gitHubNumericId: comment.gitHubNumericId,
          body: comment.body,
          bodyHtml: comment.bodyHtml,
          path: comment.path,
          line: comment.line,
          originalLine: comment.originalLine,
          diffHunk: comment.diffHunk,
          commitId: comment.commitId,
          originalCommitId: comment.originalCommitId,
          gitHubReviewId: comment.gitHubReviewId,
          parentCommentGitHubId: comment.parentCommentGitHubId,
          userLogin: comment.userLogin,
          userAvatarUrl: comment.userAvatarUrl,
          url: comment.url,
          gitHubCreatedAt: comment.gitHubCreatedAt,
          gitHubUpdatedAt: comment.gitHubUpdatedAt,
          syncedAt: comment.syncedAt,
          deletedAt: null
        }
      })
      .run()

    await syncCommentReactions(
      client,
      commentData,
      comment.id,
      pullRequestId,
      owner,
      repositoryName,
      now
    )
  }

  for (const existingComment of existingComments) {
    if (
      existingComment.path &&
      !syncedCommentGitHubIds.includes(existingComment.gitHubId)
    ) {
      database
        .update(comments)
        .set({ deletedAt: now })
        .where(eq(comments.id, existingComment.id))
        .run()
    }
  }
}

export async function syncReviews({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncReviewsParams): Promise<void> {
  console.time('syncReviews')

  try {
    const client = createRestClient(token)
    const now = new Date().toISOString()

    const reviewsEtagKey = {
      endpointType: 'reviews',
      resourceId: pullRequestId
    }
    const cachedReviewsEtag = etagManager.get(reviewsEtagKey)

    const reviewsResult = await client.request<ReviewData[]>(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      {
        owner,
        repo: repositoryName,
        pull_number: pullNumber,
        per_page: 100
      },
      { etag: cachedReviewsEtag?.etag ?? undefined }
    )

    const commentsEtagKey = {
      endpointType: 'review_comments',
      resourceId: pullRequestId
    }

    if (cachedReviewsEtag !== null && hasOrphanReviews(pullRequestId)) {
      etagManager.delete(commentsEtagKey)
    }

    const cachedCommentsEtag = etagManager.get(commentsEtagKey)

    const commentsResult = await client.request<ReviewCommentData[]>(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
      {
        owner,
        repo: repositoryName,
        pull_number: pullNumber,
        per_page: 100
      },
      { etag: cachedCommentsEtag?.etag ?? undefined }
    )

    if (reviewsResult.notModified && commentsResult.notModified) {
      console.log(`[syncReviews] No changes for PR #${pullNumber} (304)`)
      console.timeEnd('syncReviews')

      return
    }

    let reviewIdMap = new Map<number, string>()

    if (!reviewsResult.notModified) {
      const reviewsData = reviewsResult.data ?? []

      console.log(
        `Syncing ${reviewsData.length} reviews for PR #${pullNumber} in ${owner}/${repositoryName}.`
      )

      reviewIdMap = upsertReviews(reviewsData, pullRequestId, now)
    }

    if (!commentsResult.notModified) {
      if (reviewsResult.notModified) {
        reviewIdMap = buildReviewIdMapFromExisting(pullRequestId)
      }

      const commentsData = commentsResult.data ?? []

      await upsertReviewComments(
        client,
        commentsData,
        reviewIdMap,
        pullRequestId,
        owner,
        repositoryName,
        now
      )
    }

    if (reviewsResult.etag) {
      etagManager.set(
        reviewsEtagKey,
        reviewsResult.etag,
        reviewsResult.lastModified ?? undefined
      )
    }

    if (commentsResult.etag) {
      etagManager.set(
        commentsEtagKey,
        commentsResult.etag,
        commentsResult.lastModified ?? undefined
      )
    }

    console.timeEnd('syncReviews')
  } catch (error) {
    console.timeEnd('syncReviews')
    console.error('Error syncing pull request reviews:', error)
    throw error
  }
}
