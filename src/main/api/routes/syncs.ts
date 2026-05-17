import { Hono } from 'hono'

import { effectHandler, type AppEnv } from '../effect-handler'
import { triggerManualSync } from '../operations/trigger-manual-sync'

export const syncsRoute = new Hono<AppEnv>()

syncsRoute.post(
  '/',
  effectHandler(() => triggerManualSync)
)
