import { Context, Effect, Layer } from 'effect'
import { and, eq } from 'drizzle-orm'

import { Database } from '../../sync/services/database'
import type {
  Comment,
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
  }
>() {}

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

      return {
        findCommentById,
        findPullRequestByCoords,
        findPullRequestById,
        findReviewById,
        findReviewThreadById,
        requirePullRequestByCoords,
        requirePullRequestById
      }
    })
  )
