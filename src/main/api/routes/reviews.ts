import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  jsonBody,
  requireNumber,
  requireString,
  type AppEnv
} from '../effect-handler'
import {
  createPendingReview,
  deletePendingReview,
  getOrSyncPendingReview,
  submitReview,
  type CreateReviewResult,
  type SubmitReviewComment
} from '../operations/reviews'
import { ValidationError } from '../errors'

export type { CreateReviewResult as CreateReviewResponse } from '../operations/reviews'

export const reviewsRoute = new Hono<AppEnv>()

reviewsRoute.get(
  '/pending',
  effectHandler(
    (
      context
    ): Effect.Effect<
      CreateReviewResult | null,
      import('../errors').RouteError,
      import('../effect-handler').AppServices
    > =>
      Effect.gen(function* () {
        const owner = yield* requireString(context.req.query('owner'), 'owner')
        const repo = yield* requireString(context.req.query('repo'), 'repo')

        const pullNumberRaw = context.req.query('pullNumber') ?? ''
        const pullNumber = parseInt(pullNumberRaw, 10)

        if (isNaN(pullNumber)) {
          return yield* Effect.fail(
            new ValidationError({
              field: 'pullNumber',
              message: 'must be a number'
            })
          )
        }

        const token = context.get('token')

        return yield* getOrSyncPendingReview({
          owner,
          pullNumber,
          repo,
          token
        })
      })
  )
)

reviewsRoute.post(
  '/',
  effectHandler(
    (
      context
    ): Effect.Effect<
      CreateReviewResult,
      import('../errors').RouteError,
      import('../effect-handler').AppServices
    > =>
      Effect.gen(function* () {
        const raw = yield* jsonBody(context)

        const owner = yield* requireString(raw.owner, 'owner')
        const repo = yield* requireString(raw.repo, 'repo')
        const pullNumber = yield* requireNumber(raw.pullNumber, 'pullNumber')
        const token = context.get('token')

        return yield* createPendingReview({ owner, pullNumber, repo, token })
      })
  )
)

reviewsRoute.delete(
  '/:reviewId',
  effectHandler((context) =>
    Effect.gen(function* () {
      const reviewIdRaw = context.req.param('reviewId')
      const reviewId = parseInt(reviewIdRaw, 10)

      if (isNaN(reviewId) || reviewId <= 0) {
        return yield* Effect.fail(
          new ValidationError({
            field: 'reviewId',
            message: `Invalid review ID: ${reviewIdRaw}`
          })
        )
      }

      const owner = yield* requireString(context.req.query('owner'), 'owner')
      const repo = yield* requireString(context.req.query('repo'), 'repo')

      const pullNumberRaw = context.req.query('pullNumber') ?? ''
      const pullNumber = parseInt(pullNumberRaw, 10)

      if (isNaN(pullNumber)) {
        return yield* Effect.fail(
          new ValidationError({
            field: 'pullNumber',
            message: 'must be a number'
          })
        )
      }

      const token = context.get('token')

      return yield* deletePendingReview({
        owner,
        pullNumber,
        repo,
        reviewId,
        token
      })
    })
  )
)

const validEvents = ['APPROVE', 'COMMENT', 'REQUEST_CHANGES'] as const

reviewsRoute.post(
  '/:reviewId/submit',
  effectHandler((context) =>
    Effect.gen(function* () {
      const reviewIdRaw = context.req.param('reviewId')
      const reviewId = parseInt(reviewIdRaw, 10)

      if (isNaN(reviewId) || reviewId <= 0) {
        return yield* Effect.fail(
          new ValidationError({
            field: 'reviewId',
            message: `Invalid review ID: ${reviewIdRaw}`
          })
        )
      }

      const raw = yield* jsonBody(context)

      const owner = yield* requireString(raw.owner, 'owner')
      const repo = yield* requireString(raw.repo, 'repo')
      const pullNumber = yield* requireNumber(raw.pullNumber, 'pullNumber')
      const eventInput = yield* requireString(raw.event, 'event')

      if (!validEvents.includes(eventInput as (typeof validEvents)[number])) {
        return yield* Effect.fail(
          new ValidationError({
            field: 'event',
            message: 'Invalid event type'
          })
        )
      }

      const body = typeof raw.body === 'string' ? raw.body : undefined
      const comments = Array.isArray(raw.comments)
        ? (raw.comments as ReadonlyArray<SubmitReviewComment>)
        : undefined

      const token = context.get('token')

      return yield* submitReview({
        body,
        comments,
        event: eventInput as (typeof validEvents)[number],
        owner,
        pullNumber,
        repo,
        reviewId,
        token
      })
    })
  )
)
