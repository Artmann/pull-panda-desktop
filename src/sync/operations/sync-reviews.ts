import { Effect, Option } from 'effect'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'

import {
  comments,
  reviewThreads,
  reviews,
  type NewComment,
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
import { paginateRest } from '../shared/paginate'
import {
  reconcileBySoftDelete,
  reconcileCommentReactions
} from '../shared/reconcile'
import {
  generateId,
  getLineTypeFromDiffHunk,
  normalizeCommentBody
} from '../shared/utils'

interface SyncReviewsParams {
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
  paginateRest(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
    {
      owner: params.owner,
      repo: params.repositoryName,
      pull_number: params.pullNumber
    },
    ReviewsResponseSchema,
    {
      etagKey: {
        endpointType: reviewsEndpointType,
        resourceId: params.pullRequestId
      }
    }
  ).pipe(
    Effect.mapError(
      (cause) =>
        new SyncDetailFailedError({
          operation: 'reviews',
          pullRequestId: params.pullRequestId,
          cause
        }) as SyncError
    )
  )

const fetchReviewComments = (params: SyncReviewsParams) =>
  paginateRest(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
    {
      owner: params.owner,
      repo: params.repositoryName,
      pull_number: params.pullNumber
    },
    ReviewCommentsResponseSchema,
    {
      etagKey: {
        endpointType: reviewCommentsEndpointType,
        resourceId: params.pullRequestId
      }
    }
  ).pipe(
    Effect.mapError(
      (cause) =>
        new SyncDetailFailedError({
          operation: 'review_comments',
          pullRequestId: params.pullRequestId,
          cause
        }) as SyncError
    )
  )

const fetchReviewCommentReactions = (
  params: SyncReviewsParams,
  commentNumericId: number
) =>
  paginateRest(
    'GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions',
    {
      owner: params.owner,
      repo: params.repositoryName,
      comment_id: commentNumericId
    },
    ReactionsResponseSchema
  ).pipe(
    Effect.mapError(
      (cause) =>
        new SyncDetailFailedError({
          operation: 'review_comment_reactions',
          pullRequestId: params.pullRequestId,
          cause
        }) as SyncError
    ),
    Effect.map((result) =>
      Option.isNone(result) ? [] : (result.value as ReadonlyArray<Reaction>)
    )
  )

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
      const entries = reconcileBySoftDelete(db, reviews, {
        scope: [eq(reviews.pullRequestId, pullRequestId)],
        items: reviewsData,
        keyOfItem: (review) => review.node_id,
        keyOfRow: (row) => row.gitHubId,
        build: (review, existingId) =>
          buildReview(review, existingId, pullRequestId, now),
        // PENDING reviews are user-private drafts owned by explicit
        // submit/cancel actions. Never soft-delete them based on a missing
        // entry in a list response.
        protectFromDelete: (row) => row.state === 'PENDING',
        now
      })

      return new Map<number, string>(
        entries.map((entry) => [entry.item.id, entry.id])
      )
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
      (db) =>
        reconcileBySoftDelete(db, comments, {
          // Review comments only (path set) — issue comments are owned by syncComments.
          scope: [
            eq(comments.pullRequestId, params.pullRequestId),
            isNotNull(comments.path)
          ],
          items: commentsData,
          keyOfItem: (comment) => comment.node_id,
          keyOfRow: (row) => row.gitHubId,
          build: (commentData, existingId) => {
            const reviewId = commentData.pull_request_review_id
              ? (reviewIdMap.get(commentData.pull_request_review_id) ?? null)
              : null

            const parentCommentGitHubId = resolveParentCommentGitHubId(
              commentData,
              commentsData
            )

            return buildComment(
              commentData,
              existingId,
              reviewId,
              parentCommentGitHubId,
              params.pullRequestId,
              now
            )
          },
          now
        })
    )

    for (const entry of commentEntries) {
      // Always reconcile reactions against the server, even when total_count is
      // zero — otherwise removed reactions stay around locally forever.
      const reactionsData =
        entry.item.reactions && entry.item.reactions.total_count > 0
          ? yield* fetchReviewCommentReactions(params, entry.item.id)
          : ([] as ReadonlyArray<Reaction>)

      yield* database.use('syncReviews.reactions', (db) => {
        reconcileCommentReactions(db, {
          commentId: entry.id,
          pullRequestId: params.pullRequestId,
          reactions: reactionsData,
          now
        })
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
