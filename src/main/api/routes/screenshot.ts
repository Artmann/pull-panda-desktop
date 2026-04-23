import fs from 'node:fs'
import path from 'node:path'

import { Hono } from 'hono'

import { getApiMainWindow } from '../main-window-ref'
import type { AppEnv } from './comments'

export const screenshotRoute = new Hono<AppEnv>()

screenshotRoute.post('/', async (context) => {
  const mainWindow = getApiMainWindow()

  if (!mainWindow) {
    return context.json({ error: 'Main window not available' }, 503)
  }

  let filename = `screenshot-${Date.now()}.png`

  try {
    const body = await context.req.json<{ filename?: string }>()

    if (body.filename) {
      filename = body.filename
    }
  } catch {
    // No body or invalid JSON is fine, use default filename.
  }

  const image = await mainWindow.webContents.capturePage()
  const buffer = image.toPNG()

  const screenshotsDirectory = path.resolve('screenshots')

  if (!fs.existsSync(screenshotsDirectory)) {
    fs.mkdirSync(screenshotsDirectory, { recursive: true })
  }

  const filePath = path.join(screenshotsDirectory, filename)
  fs.writeFileSync(filePath, buffer)

  return context.json({ success: true, path: filePath, filename })
})
