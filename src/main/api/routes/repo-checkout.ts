import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  jsonBody,
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
      const body = yield* jsonBody(context)
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
      const body = yield* jsonBody(context)
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
      const body = yield* jsonBody(context)
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
      const body = yield* jsonBody(context)
      const fullName = yield* requireString(body.fullName, 'fullName')

      return yield* removeConnectedRepo({ fullName })
    })
  )
)

repoCheckoutRoute.post(
  '/checkout',
  effectHandler((context) =>
    Effect.gen(function* () {
      const body = yield* jsonBody(context)
      const pullRequestId = yield* requireString(
        body.pullRequestId,
        'pullRequestId'
      )

      return yield* checkoutPullRequest(pullRequestId)
    })
  )
)
