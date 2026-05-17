import { Hono } from 'hono'

import { effectHandler, type AppEnv } from '../effect-handler'
import { listChecks } from '../operations/list-checks'

export const checksRoute = new Hono<AppEnv>()

// Read-only endpoint - just returns checks from database. The background
// syncer handles the actual syncing.
checksRoute.get(
  '/:pullRequestId',
  effectHandler((context) => listChecks(context.req.param('pullRequestId')))
)
