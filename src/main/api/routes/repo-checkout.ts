import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  parseJson,
  requireString,
  type AppEnv
} from '../effect-handler'
import {
  checkoutPullRequest,
  cloneRepository,
  pickFolder,
  removeConnectedRepo,
  setConnectedRepo,
  verifyConnectedRepo
} from '../operations/repo-checkout'

export const repoCheckoutRoute = new Hono<AppEnv>()

repoCheckoutRoute.post(
  '/pick-folder',
  effectHandler(() => pickFolder)
)

repoCheckoutRoute.post(
  '/verify',
  effectHandler((context) =>
    Effect.gen(function* () {
      const body = yield* parseJson(context, (raw) => {
        const record = (raw ?? {}) as Record<string, unknown>

        return {
          fullName: record.fullName,
          localPath: record.localPath
        }
      })
      const fullName = yield* requireString(body.fullName, 'fullName')
      const localPath = yield* requireString(body.localPath, 'localPath')

      return yield* verifyConnectedRepo({ fullName, localPath })
    })
  )
)

repoCheckoutRoute.post(
  '/clone',
  effectHandler((context) =>
    Effect.gen(function* () {
      const body = yield* parseJson(context, (raw) => {
        const record = (raw ?? {}) as Record<string, unknown>

        return {
          fullName: record.fullName,
          parentDir: record.parentDir
        }
      })
      const fullName = yield* requireString(body.fullName, 'fullName')
      const parentDir = yield* requireString(body.parentDir, 'parentDir')

      return yield* cloneRepository({ fullName, parentDir })
    })
  )
)

repoCheckoutRoute.post(
  '/set',
  effectHandler((context) =>
    Effect.gen(function* () {
      const body = yield* parseJson(context, (raw) => {
        const record = (raw ?? {}) as Record<string, unknown>

        return {
          fullName: record.fullName,
          localPath: record.localPath
        }
      })
      const fullName = yield* requireString(body.fullName, 'fullName')
      const localPath = yield* requireString(body.localPath, 'localPath')

      return yield* setConnectedRepo({ fullName, localPath })
    })
  )
)

repoCheckoutRoute.post(
  '/remove',
  effectHandler((context) =>
    Effect.gen(function* () {
      const body = yield* parseJson(context, (raw) => {
        const record = (raw ?? {}) as Record<string, unknown>

        return { fullName: record.fullName }
      })
      const fullName = yield* requireString(body.fullName, 'fullName')

      return yield* removeConnectedRepo({ fullName })
    })
  )
)

repoCheckoutRoute.post(
  '/checkout',
  effectHandler((context) =>
    Effect.gen(function* () {
      const body = yield* parseJson(context, (raw) => {
        const record = (raw ?? {}) as Record<string, unknown>

        return { pullRequestId: record.pullRequestId }
      })
      const pullRequestId = yield* requireString(
        body.pullRequestId,
        'pullRequestId'
      )

      return yield* checkoutPullRequest(pullRequestId)
    })
  )
)
