import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  jsonBody,
  requireNumber,
  requireString,
  type AppEnv
} from '../effect-handler'
import { createComment } from '../operations/create-comment'
import { updateComment } from '../operations/update-comment'

export const commentsRoute = new Hono<AppEnv>()

commentsRoute.post(
  '/',
  effectHandler((context) =>
    Effect.gen(function* () {
      const raw = yield* jsonBody(context)

      const body = yield* requireString(raw.body, 'body')
      const owner = yield* requireString(raw.owner, 'owner')
      const repo = yield* requireString(raw.repo, 'repo')
      const pullNumber = yield* requireNumber(raw.pullNumber, 'pullNumber')

      const reviewCommentId =
        typeof raw.reviewCommentId === 'number'
          ? raw.reviewCommentId
          : undefined

      const token = context.get('token')

      return yield* createComment({
        body,
        owner,
        pullNumber,
        repo,
        reviewCommentId,
        token
      })
    })
  )
)

commentsRoute.patch(
  '/:commentId',
  effectHandler((context) =>
    Effect.gen(function* () {
      const commentId = yield* requireString(
        context.req.param('commentId'),
        'commentId'
      )

      const raw = yield* jsonBody(context)

      const body = yield* requireString(raw.body, 'body')

      const token = context.get('token')

      return yield* updateComment({ body, commentId, token })
    })
  )
)
