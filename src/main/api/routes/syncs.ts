import { BrowserWindow } from 'electron'
import { Hono } from 'hono'

import { ipcChannels } from '../../../lib/ipc/channels'
import {
  syncPullRequests,
  syncStalePullRequests
} from '../../../sync/pull-requests'

import type { AppEnv } from './comments'

export const syncsRoute = new Hono<AppEnv>()

syncsRoute.post('/', (context) => {
  const token = context.get('token')

  // Fire and forget - don't await
  syncPullRequests(token)
    .then(async (result) => {
      try {
        await syncStalePullRequests(token, result.syncedIds)
      } catch (error) {
        console.error('Manual sync: failed to reconcile stale PRs:', error)
      }

      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(ipcChannels.SyncComplete, {
          type: 'pull-requests'
        })
      }
    })
    .catch((error) => {
      console.error('Manual sync: failed to fetch pull requests:', error)
    })

  return context.json({ success: true })
})
