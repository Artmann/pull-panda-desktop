import { Context, Effect, Layer } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import { Database } from '../../sync/services/database'
import type {
  Comment,
  NewReview,
  PullRequest,
  Review,
  ReviewThread
} from '../../database/schema'
import {
  comments,
  pullRequests,
  reviews,
  reviewThreads
} from '../../database/schema'
import type {
  DatabaseNotInitializedError,
  DatabaseQueryError,
  NotFoundError as SyncNotFoundError
} from '../../sync/errors'
import { NotFoundError } from '../../sync/errors'
import { generateId } from '../../sync/shared/utils'

export interface PullRequestCoordinates {
  readonly number: number
  readonly owner: string
  readonly repo: string
}

type RepoError = DatabaseQueryError | DatabaseNotInitializedError

export class Repository extends Context.Tag('main/Repository')<
  Repository,
  {
    readonly findCommentById: (
      id: string
    ) => Effect.Effect<Comment | null, RepoError>
    readonly findPullRequestByCoords: (
      coords: PullRequestCoordinates
    ) => Effect.Effect<PullRequest | null, RepoError>
    readonly findPullRequestById: (
      id: string
    ) => Effect.Effect<PullRequest | null, RepoError>
    readonly findReviewById: (
      id: string
    ) => Effect.Effect<Review | null, RepoError>
    readonly findReviewThreadById: (
      id: string
    ) => Effect.Effect<ReviewThread | null, RepoError>
    readonly requirePullRequestByCoords: (
      coords: PullRequestCoordinates
    ) => Effect.Effect<PullRequest, RepoError | SyncNotFoundError>
    readonly requirePullRequestById: (
      id: string
    ) => Effect.Effect<PullRequest, RepoError | SyncNotFoundError>
    readonly softDeletePendingReviews: (input: {
      readonly pullRequestId: string
    }) => Effect.Effect<number, RepoError>
    readonly upsertReview: (input: {
      readonly pullRequestId: string
      readonly review: UpsertReviewInput
    }) => Effect.Effect<Review, RepoError>
  }
>() {}

export interface UpsertReviewInput {
  readonly authorAvatarUrl: string | null
  readonly authorLogin: string | null
  readonly body: string | null
  readonly bodyHtml: string | null
  readonly gitHubId: string
  readonly gitHubNumericId: number | null
  readonly gitHubCreatedAt: string | null
  readonly gitHubSubmittedAt: string | null
  readonly state: string
  readonly url: string | null
}

export const RepositoryLive: Layer.Layer<Repository, never, Database> =
  Layer.effect(
    Repository,
    Effect.gen(function* () {
      const database = yield* Database

      const findPullRequestByCoords = ({
        number,
        owner,
        repo
      }: PullRequestCoordinates) =>
        database.use(
          'repository.findPullRequestByCoords',
          (db) =>
            db
              .select()
              .from(pullRequests)
              .where(
                and(
                  eq(pullRequests.repositoryOwner, owner),
                  eq(pullRequests.repositoryName, repo),
                  eq(pullRequests.number, number)
                )
              )
              .get() ?? null
        )

      const findPullRequestById = (id: string) =>
        database.use(
          'repository.findPullRequestById',
          (db) =>
            db
              .select()
              .from(pullRequests)
              .where(eq(pullRequests.id, id))
              .get() ?? null
        )

      const findReviewById = (id: string) =>
        database.use(
          'repository.findReviewById',
          (db) =>
            db.select().from(reviews).where(eq(reviews.id, id)).get() ?? null
        )

      const findReviewThreadById = (id: string) =>
        database.use(
          'repository.findReviewThreadById',
          (db) =>
            db
              .select()
              .from(reviewThreads)
              .where(eq(reviewThreads.id, id))
              .get() ?? null
        )

      const findCommentById = (id: string) =>
        database.use(
          'repository.findCommentById',
          (db) =>
            db.select().from(comments).where(eq(comments.id, id)).get() ?? null
        )

      const requirePullRequestById = (id: string) =>
        Effect.flatMap(findPullRequestById(id), (record) =>
          record
            ? Effect.succeed(record)
            : Effect.fail(
                new NotFoundError({
                  route: 'repository.requirePullRequestById',
                  resourceId: id
                })
              )
        )

      const requirePullRequestByCoords = (coords: PullRequestCoordinates) =>
        Effect.flatMap(findPullRequestByCoords(coords), (record) =>
          record
            ? Effect.succeed(record)
            : Effect.fail(
                new NotFoundError({
                  route: 'repository.requirePullRequestByCoords',
                  resourceId: `${coords.owner}/${coords.repo}#${coords.number}`
                })
              )
        )

      // PENDING reviews are protected from the regular sync clean-up (GitHub
      // hides other users' pending reviews, so a missing review does not mean
      // it was deleted). When the app itself deletes or replaces a pending
      // review on GitHub, this removes the now-stale local rows so they do
      // not resurface as zombie drafts on the next launch.
      const softDeletePendingReviews = ({
        pullRequestId
      }: {
        pullRequestId: string
      }) =>
        database.use('repository.softDeletePendingReviews', (db) => {
          const stale = db
            .select({ id: reviews.id })
            .from(reviews)
            .where(
              and(
                eq(reviews.pullRequestId, pullRequestId),
                eq(reviews.state, 'PENDING'),
                isNull(reviews.deletedAt)
              )
            )
            .all()

          if (stale.length === 0) {
            return 0
          }

          const now = new Date().toISOString()

          for (const row of stale) {
            db.update(reviews)
              .set({ deletedAt: now })
              .where(eq(reviews.id, row.id))
              .run()
          }

          return stale.length
        })

      const upsertReview = ({
        pullRequestId,
        review
      }: {
        pullRequestId: string
        review: UpsertReviewInput
      }) =>
        database.use('repository.upsertReview', (db) => {
          const existing = db
            .select()
            .from(reviews)
            .where(
              and(
                eq(reviews.pullRequestId, pullRequestId),
                eq(reviews.gitHubId, review.gitHubId),
                isNull(reviews.deletedAt)
              )
            )
            .get()

          const now = new Date().toISOString()
          const id = existing?.id ?? generateId()

          const row: NewReview = {
            authorAvatarUrl: review.authorAvatarUrl,
            authorLogin: review.authorLogin,
            body: review.body,
            bodyHtml: review.bodyHtml,
            deletedAt: null,
            gitHubCreatedAt: review.gitHubCreatedAt,
            gitHubId: review.gitHubId,
            gitHubNumericId: review.gitHubNumericId,
            gitHubSubmittedAt: review.gitHubSubmittedAt,
            id,
            pullRequestId,
            state: review.state,
            syncedAt: now,
            url: review.url
          }

          db.insert(reviews)
            .values(row)
            .onConflictDoUpdate({
              target: reviews.id,
              set: {
                authorAvatarUrl: row.authorAvatarUrl,
                authorLogin: row.authorLogin,
                body: row.body,
                bodyHtml: row.bodyHtml,
                deletedAt: null,
                gitHubCreatedAt: row.gitHubCreatedAt,
                gitHubNumericId: row.gitHubNumericId,
                gitHubSubmittedAt: row.gitHubSubmittedAt,
                state: row.state,
                syncedAt: row.syncedAt,
                url: row.url
              }
            })
            .run()

          const persisted = db
            .select()
            .from(reviews)
            .where(eq(reviews.id, id))
            .get()

          if (!persisted) {
            throw new Error(`Failed to read back upserted review ${id}`)
          }

          return persisted
        })

      return {
        findCommentById,
        findPullRequestByCoords,
        findPullRequestById,
        findReviewById,
        findReviewThreadById,
        requirePullRequestByCoords,
        requirePullRequestById,
        softDeletePendingReviews,
        upsertReview
      }
    })
  )
