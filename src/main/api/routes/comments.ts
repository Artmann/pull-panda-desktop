import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  parseJson,
  requireNumber,
  requireString,
  type AppEnv
} from '../effect-handler'
import { createComment } from '../operations/create-comment'

export const commentsRoute = new Hono<AppEnv>()

commentsRoute.post(
  '/',
  effectHandler((context) =>
    Effect.gen(function* () {
      const raw = yield* parseJson(context, (input) => {
        const record = (input ?? {}) as Record<string, unknown>

        return {
          body: record.body,
          owner: record.owner,
          pullNumber: record.pullNumber,
          repo: record.repo,
          reviewCommentId: record.reviewCommentId
        }
      })

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
