import { Effect, Option } from 'effect'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'

import {
  commentReactions,
  comments,
  reviewThreads,
  reviews,
  type NewComment,
  type NewCommentReaction,
  type NewReview
} from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import {
  ReactionsResponseSchema,
  ReviewCommentsResponseSchema,
  ReviewsResponseSchema,
  type Reaction,
  type Review,
  type ReviewComment
} from '../schemas/github-rest'
import { Database } from '../services/database'
import { EtagStore } from '../services/etag-store'
import { GitHubRest } from '../services/github-rest'
import {
  generateId,
  getLineTypeFromDiffHunk,
  normalizeCommentBody
} from '../shared/utils'

export interface SyncReviewsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const reviewsEndpointType = 'reviews'
const reviewCommentsEndpointType = 'review_comments'

const buildReview = (
  reviewData: Review,
  existingId: string | undefined,
  pullRequestId: string,
  now: string
): NewReview => ({
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
})

const resolveCommentLine = (
  commentData: ReviewComment
): { line: number | null; originalLine: number | null } => {
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

const resolveParentCommentGitHubId = (
  commentData: ReviewComment,
  commentsData: ReadonlyArray<ReviewComment>
): string | null => {
  if (!commentData.in_reply_to_id) {
    return null
  }

  const parent = commentsData.find(
    (entry) => entry.id === commentData.in_reply_to_id
  )

  return parent?.node_id ?? null
}

const buildComment = (
  commentData: ReviewComment,
  existingId: string | undefined,
  reviewId: string | null,
  parentCommentGitHubId: string | null,
  pullRequestId: string,
  now: string
): NewComment => {
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

const fetchReviews = (params: SyncReviewsParams) =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest

    return yield* rest
      .request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        {
          owner: params.owner,
          repo: params.repositoryName,
          pull_number: params.pullNumber,
          per_page: 100
        },
        ReviewsResponseSchema,
        {
          etagKey: {
            endpointType: reviewsEndpointType,
            resourceId: params.pullRequestId
          }
        }
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new SyncDetailFailedError({
              operation: 'reviews',
              pullRequestId: params.pullRequestId,
              cause
            }) as SyncError
        )
      )
  })

const fetchReviewComments = (params: SyncReviewsParams) =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest

    return yield* rest
      .request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
        {
          owner: params.owner,
          repo: params.repositoryName,
          pull_number: params.pullNumber,
          per_page: 100
        },
        ReviewCommentsResponseSchema,
        {
          etagKey: {
            endpointType: reviewCommentsEndpointType,
            resourceId: params.pullRequestId
          }
        }
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new SyncDetailFailedError({
              operation: 'review_comments',
              pullRequestId: params.pullRequestId,
              cause
            }) as SyncError
        )
      )
  })

const fetchReviewCommentReactions = (
  params: SyncReviewsParams,
  commentNumericId: number
) =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest

    const result = yield* rest
      .request(
        'GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions',
        {
          owner: params.owner,
          repo: params.repositoryName,
          comment_id: commentNumericId
        },
        ReactionsResponseSchema
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new SyncDetailFailedError({
              operation: 'review_comment_reactions',
              pullRequestId: params.pullRequestId,
              cause
            }) as SyncError
        )
      )

    if (Option.isNone(result)) {
      return [] as ReadonlyArray<Reaction>
    }

    return result.value as ReadonlyArray<Reaction>
  })

const hasOrphanReviews = (pullRequestId: string) =>
  Effect.gen(function* () {
    const database = yield* Database

    return yield* database.use('syncReviews.orphanCheck', (db) => {
      const threads = db
        .select()
        .from(reviewThreads)
        .where(
          and(
            eq(reviewThreads.pullRequestId, pullRequestId),
            isNull(reviewThreads.deletedAt)
          )
        )
        .all()

      if (threads.length === 0) {
        return false
      }

      const reviewCommentRows = db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.pullRequestId, pullRequestId),
            isNull(comments.deletedAt),
            isNotNull(comments.path)
          )
        )
        .all()

      return reviewCommentRows.length === 0
    })
  })

const upsertReviews = (
  reviewsData: ReadonlyArray<Review>,
  pullRequestId: string,
  now: string
) =>
  Effect.gen(function* () {
    const database = yield* Database

    return yield* database.use('syncReviews.upsertReviews', (db) => {
      const existingReviews = db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.pullRequestId, pullRequestId),
            isNull(reviews.deletedAt)
          )
        )
        .all()

      const syncedReviewGitHubIds: string[] = []
      const reviewIdMap = new Map<number, string>()

      for (const reviewData of reviewsData) {
        syncedReviewGitHubIds.push(reviewData.node_id)

        const existingReview = existingReviews.find(
          (row) => row.gitHubId === reviewData.node_id
        )

        const review = buildReview(
          reviewData,
          existingReview?.id,
          pullRequestId,
          now
        )
        reviewIdMap.set(reviewData.id, review.id)

        db.insert(reviews)
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
          db.update(reviews)
            .set({ deletedAt: now })
            .where(eq(reviews.id, existingReview.id))
            .run()
        }
      }

      return reviewIdMap
    })
  })

const buildReviewIdMapFromExisting = (pullRequestId: string) =>
  Effect.gen(function* () {
    const database = yield* Database

    return yield* database.use('syncReviews.idMapFromExisting', (db) => {
      const existingReviews = db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.pullRequestId, pullRequestId),
            isNull(reviews.deletedAt)
          )
        )
        .all()

      const reviewIdMap = new Map<number, string>()

      for (const review of existingReviews) {
        reviewIdMap.set(review.gitHubNumericId, review.id)
      }

      return reviewIdMap
    })
  })

const upsertReviewComments = (
  params: SyncReviewsParams,
  commentsData: ReadonlyArray<ReviewComment>,
  reviewIdMap: Map<number, string>,
  now: string
) =>
  Effect.gen(function* () {
    const database = yield* Database

    const commentEntries = yield* database.use(
      'syncReviews.upsertComments',
      (db) => {
        const existingComments = db
          .select()
          .from(comments)
          .where(
            and(
              eq(comments.pullRequestId, params.pullRequestId),
              isNull(comments.deletedAt)
            )
          )
          .all()

        const syncedCommentGitHubIds: string[] = []
        const entries: Array<{ commentId: string; comment: ReviewComment }> = []

        for (const commentData of commentsData) {
          syncedCommentGitHubIds.push(commentData.node_id)

          const existingComment = existingComments.find(
            (row) => row.gitHubId === commentData.node_id
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
            params.pullRequestId,
            now
          )

          entries.push({ commentId: comment.id, comment: commentData })

          db.insert(comments)
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
        }

        for (const existingComment of existingComments) {
          if (
            existingComment.path &&
            !syncedCommentGitHubIds.includes(existingComment.gitHubId)
          ) {
            db.update(comments)
              .set({ deletedAt: now })
              .where(eq(comments.id, existingComment.id))
              .run()
          }
        }

        return entries
      }
    )

    for (const entry of commentEntries) {
      if (
        !entry.comment.reactions ||
        entry.comment.reactions.total_count === 0
      ) {
        continue
      }

      const reactionsData = yield* fetchReviewCommentReactions(
        params,
        entry.comment.id
      )

      yield* database.use('syncReviews.reactions', (db) => {
        for (const reactionData of reactionsData) {
          if (!reactionData.user) {
            continue
          }

          const existingReaction = db
            .select()
            .from(commentReactions)
            .where(eq(commentReactions.gitHubId, reactionData.node_id))
            .get()

          const reaction: NewCommentReaction = {
            id: existingReaction?.id ?? generateId(),
            gitHubId: reactionData.node_id,
            commentId: entry.commentId,
            pullRequestId: params.pullRequestId,
            content: reactionData.content,
            userLogin: reactionData.user.login,
            userId: String(reactionData.user.id),
            syncedAt: now,
            deletedAt: null
          }

          db.insert(commentReactions)
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
      })
    }
  })

export const syncReviews = (
  params: SyncReviewsParams
): Effect.Effect<void, SyncError, Database | GitHubRest | EtagStore> =>
  Effect.gen(function* () {
    const etagStore = yield* EtagStore
    const now = new Date().toISOString()

    const reviewsResult = yield* fetchReviews(params)

    const reviewCommentsEtagKey = {
      endpointType: reviewCommentsEndpointType,
      resourceId: params.pullRequestId
    }

    const orphan = yield* hasOrphanReviews(params.pullRequestId)

    if (orphan) {
      yield* etagStore
        .remove(reviewCommentsEtagKey)
        .pipe(Effect.catchAll(() => Effect.void))
    }

    const commentsResult = yield* fetchReviewComments(params)

    if (Option.isNone(reviewsResult) && Option.isNone(commentsResult)) {
      return
    }

    let reviewIdMap = new Map<number, string>()

    if (Option.isSome(reviewsResult)) {
      const reviewsData = reviewsResult.value as ReadonlyArray<Review>
      reviewIdMap = yield* upsertReviews(reviewsData, params.pullRequestId, now)
    }

    if (Option.isSome(commentsResult)) {
      if (Option.isNone(reviewsResult)) {
        reviewIdMap = yield* buildReviewIdMapFromExisting(params.pullRequestId)
      }

      const commentsData = commentsResult.value as ReadonlyArray<ReviewComment>

      yield* upsertReviewComments(params, commentsData, reviewIdMap, now)
    }
  })
