import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  parseJson,
  requireNumber,
  requireString,
  type AppEnv
} from '../effect-handler'
import {
  resolveReviewThread,
  unresolveReviewThread,
  type ToggleReviewThreadInput
} from '../operations/toggle-review-thread'
import type { ValidationError } from '../errors'

const parseInput = (
  context: Parameters<typeof parseJson>[0]
): Effect.Effect<ToggleReviewThreadInput, ValidationError> =>
  Effect.gen(function* () {
    const raw = yield* parseJson(context, (input) => {
      const record = (input ?? {}) as Record<string, unknown>

      return {
        owner: record.owner,
        pullNumber: record.pullNumber,
        repo: record.repo,
        threadId: record.threadId
      }
    })

    const owner = yield* requireString(raw.owner, 'owner')
    const repo = yield* requireString(raw.repo, 'repo')
    const threadId = yield* requireString(raw.threadId, 'threadId')
    const pullNumber = yield* requireNumber(raw.pullNumber, 'pullNumber')

    return { owner, pullNumber, repo, threadId }
  })

export const reviewThreadsRoute = new Hono<AppEnv>()

reviewThreadsRoute.post(
  '/resolve',
  effectHandler((context) =>
    Effect.gen(function* () {
      const input = yield* parseInput(context)

      return yield* resolveReviewThread(input)
    })
  )
)

reviewThreadsRoute.post(
  '/unresolve',
  effectHandler((context) =>
    Effect.gen(function* () {
      const input = yield* parseInput(context)

      return yield* unresolveReviewThread(input)
    })
  )
)
