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

import { createGraphqlClient } from './graphql'
import { reviewsQuery, type ReviewsQueryResponse } from './queries'
import {
  generateId,
  normalizeCommentBody,
  getLineTypeFromDiffHunk
} from './utils'

interface SyncReviewsParams {
  client: ReturnType<typeof createGraphqlClient>
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export async function syncReviews({
  client,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncReviewsParams): Promise<void> {
  console.time('syncReviews')

  try {
    const response = await client<ReviewsQueryResponse>(reviewsQuery, {
      owner,
      repo: repositoryName,
      pullNumber
    })

    const reviewsData =
      response.repository?.pullRequest?.reviews?.nodes?.filter(
        (review) => review !== null
      ) ?? []

    console.log(
      `Syncing ${reviewsData.length} reviews for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingReviews = await database
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.pullRequestId, pullRequestId), isNull(reviews.deletedAt))
      )

    const syncedReviewGitHubIds: string[] = []

    for (const reviewData of reviewsData) {
      if (!reviewData) {
        continue
      }

      const gitHubId = reviewData.id
      syncedReviewGitHubIds.push(gitHubId)

      const existingReview = existingReviews.find(
        (r) => r.gitHubId === gitHubId
      )

      const reviewId = existingReview?.id ?? generateId()

      const review: NewReview = {
        id: reviewId,
        gitHubId,
        pullRequestId,
        state: reviewData.state ?? 'PENDING',
        body: reviewData.body ? normalizeCommentBody(reviewData.body) : null,
        url: reviewData.url ?? null,
        authorLogin: reviewData.author?.login ?? null,
        authorAvatarUrl: reviewData.author?.avatarUrl ?? null,
        gitHubCreatedAt: reviewData.createdAt ?? null,
        gitHubSubmittedAt: reviewData.submittedAt ?? reviewData.createdAt ?? null,
        syncedAt: now,
        deletedAt: null
      }

      await database
        .insert(reviews)
        .values(review)
        .onConflictDoUpdate({
          target: reviews.id,
          set: {
            state: review.state,
            body: review.body,
            url: review.url,
            authorLogin: review.authorLogin,
            authorAvatarUrl: review.authorAvatarUrl,
            gitHubCreatedAt: review.gitHubCreatedAt,
            gitHubSubmittedAt: review.gitHubSubmittedAt,
            syncedAt: review.syncedAt,
            deletedAt: null
          }
        })

      const commentNodes =
        reviewData.comments.nodes?.filter((node) => node !== null) ?? []

      for (const commentData of commentNodes) {
        if (!commentData) {
          continue
        }

        const existingComment = await database
          .select()
          .from(comments)
          .where(eq(comments.gitHubId, commentData.id))
          .limit(1)

        const commentId = existingComment[0]?.id ?? generateId()

        const lineType = getLineTypeFromDiffHunk(commentData.diffHunk ?? '')
        let line: number | null = null
        let originalLine: number | null = null

        if (lineType === 'remove') {
          originalLine = commentData.originalLine ?? null
        } else if (lineType === 'add') {
          line = commentData.line ?? null
        } else {
          line = commentData.line ?? null
          originalLine = commentData.originalLine ?? null
        }

        const comment: NewComment = {
          id: commentId,
          gitHubId: commentData.id,
          pullRequestId,
          reviewId,
          body: commentData.body ? normalizeCommentBody(commentData.body) : null,
          path: commentData.path ?? null,
          line,
          originalLine,
          diffHunk: commentData.diffHunk ?? null,
          commitId: commentData.commit?.oid ?? null,
          originalCommitId: commentData.originalCommit?.oid ?? null,
          gitHubReviewId: commentData.pullRequestReview?.id ?? null,
          gitHubReviewThreadId: null,
          parentCommentGitHubId: commentData.replyTo?.id ?? null,
          userLogin: commentData.author?.login ?? null,
          userAvatarUrl: commentData.author?.avatarUrl ?? null,
          url: commentData.url ?? null,
          gitHubCreatedAt: commentData.createdAt ?? null,
          gitHubUpdatedAt: commentData.updatedAt ?? null,
          syncedAt: now,
          deletedAt: null
        }

        await database
          .insert(comments)
          .values(comment)
          .onConflictDoUpdate({
            target: comments.id,
            set: {
              body: comment.body,
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

        const reactions =
          commentData.reactions.nodes?.filter((r) => r !== null) ?? []

        for (const reactionData of reactions) {
          if (!reactionData?.user) {
            continue
          }

          const existingReaction = await database
            .select()
            .from(commentReactions)
            .where(eq(commentReactions.gitHubId, reactionData.id))
            .limit(1)

          const reaction: NewCommentReaction = {
            id: existingReaction[0]?.id ?? generateId(),
            gitHubId: reactionData.id,
            commentId,
            pullRequestId,
            content: reactionData.content,
            userLogin: reactionData.user.login,
            userId: reactionData.user.id,
            syncedAt: now,
            deletedAt: null
          }

          await database
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
        }
      }
    }

    for (const existingReview of existingReviews) {
      if (!syncedReviewGitHubIds.includes(existingReview.gitHubId)) {
        await database
          .update(reviews)
          .set({ deletedAt: now })
          .where(eq(reviews.id, existingReview.id))
      }
    }

    console.timeEnd('syncReviews')
  } catch (error) {
    console.timeEnd('syncReviews')
    console.error('Error syncing pull request reviews:', error)
    throw error
  }
}
