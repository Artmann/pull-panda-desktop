import { Hono } from 'hono'

import { ipcChannels } from '../../../lib/ipc/channels'
import { getApiMainWindow } from '../main-window-ref'
import type { AppEnv } from './comments'

export const navigateRoute = new Hono<AppEnv>()

navigateRoute.post('/', async (context) => {
  const mainWindow = getApiMainWindow()

  if (!mainWindow) {
    return context.json({ error: 'Main window not available' }, 503)
  }

  const body = await context.req.json<{ path: string }>()

  if (!body.path) {
    return context.json({ error: 'Missing required field: path' }, 400)
  }

  mainWindow.webContents.send(ipcChannels.NavigateTo, body.path)
  mainWindow.show()
  mainWindow.focus()

  return context.json({ success: true, path: body.path })
})
