import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import {
  reviews,
  comments,
  commentReactions,
  type NewReview,
  type NewComment,
  type NewCommentReaction
} from '../database/schema'

import { createRestClient } from './restClient'
import { etagManager } from './etagManager'
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
    const database = getDatabase()
    const now = new Date().toISOString()

    // Fetch reviews
    const reviewsEtagKey = { endpointType: 'reviews', resourceId: pullRequestId }
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

    // Fetch review comments
    const commentsEtagKey = { endpointType: 'review_comments', resourceId: pullRequestId }
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

    // If both are 304, skip processing entirely
    if (reviewsResult.notModified && commentsResult.notModified) {
      console.log(`[syncReviews] No changes for PR #${pullNumber} (304)`)
      console.timeEnd('syncReviews')

      return
    }

    // Process reviews (if changed)
    const reviewsData = reviewsResult.data ?? []
    const existingReviews = database
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.pullRequestId, pullRequestId), isNull(reviews.deletedAt))
      )
      .all()

    const syncedReviewGitHubIds: string[] = []
    const reviewIdMap = new Map<number, string>() // REST id -> local id

    console.log(
      `Syncing ${reviewsData.length} reviews for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    for (const reviewData of reviewsData) {
      const gitHubId = reviewData.node_id
      syncedReviewGitHubIds.push(gitHubId)

      const existingReview = existingReviews.find(
        (r) => r.gitHubId === gitHubId
      )

      const reviewId = existingReview?.id ?? generateId()
      reviewIdMap.set(reviewData.id, reviewId)

      const review: NewReview = {
        id: reviewId,
        gitHubId,
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

      database
        .insert(reviews)
        .values(review)
        .onConflictDoUpdate({
          target: reviews.id,
          set: {
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

    // Soft delete reviews that no longer exist
    for (const existingReview of existingReviews) {
      if (!syncedReviewGitHubIds.includes(existingReview.gitHubId)) {
        database
          .update(reviews)
          .set({ deletedAt: now })
          .where(eq(reviews.id, existingReview.id))
          .run()
      }
    }

    // Process review comments
    const commentsData = commentsResult.data ?? []
    const existingComments = database
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.pullRequestId, pullRequestId),
          isNull(comments.deletedAt)
        )
      )
      .all()

    const syncedCommentGitHubIds: string[] = []
    const commentIdMap = new Map<number, string>() // REST id -> local id

    for (const commentData of commentsData) {
      const gitHubId = commentData.node_id
      syncedCommentGitHubIds.push(gitHubId)

      const existingComment = existingComments.find(
        (c) => c.gitHubId === gitHubId
      )

      const commentId = existingComment?.id ?? generateId()
      commentIdMap.set(commentData.id, commentId)

      // Get the local review ID from the map
      const reviewId = commentData.pull_request_review_id
        ? reviewIdMap.get(commentData.pull_request_review_id) ?? null
        : null

      const lineType = getLineTypeFromDiffHunk(commentData.diff_hunk ?? '')
      let line: number | null = null
      let originalLine: number | null = null

      if (lineType === 'remove') {
        originalLine = commentData.original_line
      } else if (lineType === 'add') {
        line = commentData.line
      } else {
        line = commentData.line
        originalLine = commentData.original_line
      }

      // Find parent comment's gitHubId if this is a reply
      let parentCommentGitHubId: string | null = null

      if (commentData.in_reply_to_id) {
        const parentComment = commentsData.find(
          (c) => c.id === commentData.in_reply_to_id
        )

        parentCommentGitHubId = parentComment?.node_id ?? null
      }

      const comment: NewComment = {
        id: commentId,
        gitHubId,
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

      // Fetch reactions for this comment if it has any
      if (commentData.reactions && commentData.reactions.total_count > 0) {
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
    }

    // Soft delete comments that no longer exist (only review comments, not issue comments)
    for (const existingComment of existingComments) {
      if (
        existingComment.path && // Has path = review comment
        !syncedCommentGitHubIds.includes(existingComment.gitHubId)
      ) {
        database
          .update(comments)
          .set({ deletedAt: now })
          .where(eq(comments.id, existingComment.id))
          .run()
      }
    }

    // Store the new ETags
    if (reviewsResult.etag) {
      etagManager.set(reviewsEtagKey, reviewsResult.etag, reviewsResult.lastModified ?? undefined)
    }

    if (commentsResult.etag) {
      etagManager.set(commentsEtagKey, commentsResult.etag, commentsResult.lastModified ?? undefined)
    }

    console.timeEnd('syncReviews')
  } catch (error) {
    console.timeEnd('syncReviews')
    console.error('Error syncing pull request reviews:', error)
    throw error
  }
}
