import { BrowserWindow } from 'electron'
import { Hono } from 'hono'

import { ipcChannels } from '../../../lib/ipc/channels'
import { syncPullRequests } from '../../../sync/pull-requests'

import type { AppEnv } from './comments'

export const syncsRoute = new Hono<AppEnv>()

syncsRoute.post('/', (context) => {
  const token = context.get('token')

  // Fire and forget - don't await
  syncPullRequests(token).then(() => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.SyncComplete, {
        type: 'pull-requests'
      })
    }
  })

  return context.json({ success: true })
})
