import { Effect } from 'effect'
import { Hono } from 'hono'

import { effectHandler, requireString, type AppEnv } from '../effect-handler'
import { listCollaborators } from '../operations/list-collaborators'
import { listCodeowners } from '../operations/list-codeowners'

export const reposRoute = new Hono<AppEnv>()

reposRoute.get(
  '/:owner/:name/collaborators',
  effectHandler((context) =>
    Effect.gen(function* () {
      const owner = yield* requireString(context.req.param('owner'), 'owner')
      const repo = yield* requireString(context.req.param('name'), 'name')
      const token = context.get('token')

      return yield* listCollaborators({ owner, repo, token })
    })
  )
)

reposRoute.get(
  '/:owner/:name/codeowners',
  effectHandler((context) =>
    Effect.gen(function* () {
      const owner = yield* requireString(context.req.param('owner'), 'owner')
      const repo = yield* requireString(context.req.param('name'), 'name')
      const token = context.get('token')
      const pullRequestId = context.req.query('pullRequestId') ?? null

      return yield* listCodeowners({ owner, pullRequestId, repo, token })
    })
  )
)
