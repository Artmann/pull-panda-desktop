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
        const staleUpdated = await syncStalePullRequests(
          token,
          result.syncedIds
        )

        if (staleUpdated > 0) {
          console.log(`Updated ${staleUpdated} stale pull requests`)
        }
      } catch (error) {
        console.error('Failed to sync stale pull requests:', error)
      }

      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(ipcChannels.SyncComplete, {
          type: 'pull-requests'
        })
      }
    })
    .catch((error) => {
      console.error('Failed to sync pull requests:', error)
    })

  return context.json({ success: true })
})
