import { BrowserWindow } from 'electron'
import { Hono } from 'hono'

import { ipcChannels } from '../../../lib/ipc/channels'
import { bootstrap } from '../../bootstrap'
import { syncPullRequests } from '../../../sync/pull-requests'
import { getGitHubUser } from '../../../auth'

import type { AppEnv } from './comments'

export const syncsRoute = new Hono<AppEnv>()

syncsRoute.post('/', (context) => {
  const token = context.get('token')

  // Fire and forget - don't await
  syncPullRequests(token).then(async () => {
    const user = await getGitHubUser(token).catch(() => null)
    const bootstrapData = await bootstrap(user?.login)

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.ResourceUpdated, {
        type: 'pull-requests',
        data: bootstrapData.pullRequests
      })

      window.webContents.send(ipcChannels.SyncComplete, {
        type: 'pull-requests'
      })
    }
  })

  return context.json({ success: true })
})
