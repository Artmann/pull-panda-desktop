import { app, BrowserWindow, ipcMain, shell } from 'electron'
import started from 'electron-squirrel-startup'
import path from 'node:path'

import { initializeDatabase, closeDatabase, saveDatabase } from './database'
import { ipcChannels } from './lib/ipc/channels'
import { getApiPort, startApiServer } from './main/api'
import {
  bootstrap,
  BootstrapData,
  getPullRequestDetails
} from './main/bootstrap'
import { backgroundSyncer } from './main/background-syncer'
import { taskManager } from './main/task-manager'
import { syncPullRequests } from './sync/pull-requests'
import { syncPullRequestDetails } from './sync/sync-pull-request-details'
import {
  clearToken,
  getGitHubUser,
  loadToken,
  pollForToken,
  requestDeviceCode,
  saveToken
} from './auth'

let bootstrapData: BootstrapData | null = null
let mainWindow: BrowserWindow | null = null

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

function setupIpcHandlers(): void {
  ipcMain.handle(ipcChannels.ApiGetPort, () => {
    return getApiPort()
  })

  ipcMain.handle(ipcChannels.GetBootstrapData, () => {
    return bootstrapData
  })

  ipcMain.handle(ipcChannels.GetTasks, () => {
    return taskManager.getTasks()
  })

  ipcMain.handle(ipcChannels.AuthRequestDeviceCode, async () => {
    return requestDeviceCode()
  })

  ipcMain.handle(
    ipcChannels.AuthPollToken,
    async (_event, deviceCode: string, interval: number) => {
      const tokenResponse = await pollForToken(deviceCode, interval)

      saveToken(tokenResponse.access_token)

      return { success: true }
    }
  )

  ipcMain.handle(ipcChannels.AuthGetToken, async () => {
    return loadToken()
  })

  ipcMain.handle(ipcChannels.AuthClearToken, async () => {
    clearToken()

    return { success: true }
  })

  ipcMain.handle(ipcChannels.AuthOpenUrl, async (_event, url: string) => {
    await shell.openExternal(url)

    return { success: true }
  })

  ipcMain.handle(ipcChannels.OpenUrl, async (_event, url: string) => {
    await shell.openExternal(url)

    return { success: true }
  })

  ipcMain.handle(ipcChannels.AuthGetUser, async () => {
    const token = loadToken()

    if (!token) {
      return null
    }

    try {
      return await getGitHubUser(token)
    } catch {
      return null
    }
  })

  ipcMain.handle(ipcChannels.WindowClose, () => {
    mainWindow?.close()
  })

  ipcMain.handle(ipcChannels.WindowMaximize, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle(ipcChannels.WindowMinimize, () => {
    mainWindow?.minimize()
  })

  ipcMain.handle(
    ipcChannels.GetPullRequestDetails,
    async (_event, pullRequestId: string) => {
      return getPullRequestDetails(pullRequestId)
    }
  )

  ipcMain.handle(
    ipcChannels.PullRequestOpened,
    (_event, pullRequestId: string) => {
      backgroundSyncer.markPullRequestActive(pullRequestId)
    }
  )

  ipcMain.handle(ipcChannels.GetSyncerStats, () => {
    return backgroundSyncer.getMonitoringData()
  })

  ipcMain.handle(
    ipcChannels.SyncPullRequestDetails,
    async (
      _event,
      pullRequestId: string,
      owner: string,
      repositoryName: string,
      pullNumber: number
    ) => {
      const token = loadToken()

      if (!token) {
        return { success: false, errors: ['No token available'] }
      }

      const result = await syncPullRequestDetails({
        token,
        pullRequestId,
        owner,
        repositoryName,
        pullNumber
      })

      // Save database after sync
      saveDatabase()

      mainWindow?.webContents.send(ipcChannels.SyncComplete, {
        type: 'pull-request-details',
        pullRequestId
      })

      return result
    }
  )
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    frame: false,
    height: 700,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
    width: 1200
  })

  taskManager.setMainWindow(mainWindow)

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    )
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
function needsSync(pullRequest: {
  detailsSyncedAt: string | null
  updatedAt: string
}): boolean {
  // Never synced before
  if (!pullRequest.detailsSyncedAt) {
    return true
  }

  const now = Date.now()
  const updatedAt = new Date(pullRequest.updatedAt).getTime()
  const detailsSyncedAt = new Date(pullRequest.detailsSyncedAt).getTime()

  // Updated on GitHub since last sync
  if (updatedAt > detailsSyncedAt) {
    return true
  }

  // Use shorter stale threshold for recently active PRs
  const oneDayMs = 24 * 60 * 60 * 1000
  const isRecentlyUpdated = now - updatedAt < oneDayMs
  const staleThresholdMs = isRecentlyUpdated ? 60 * 1000 : 60 * 60 * 1000

  if (now - detailsSyncedAt > staleThresholdMs) {
    return true
  }

  return false
}

async function syncAllPullRequestDetails(token: string): Promise<void> {
  if (!bootstrapData) {
    return
  }

  const allPullRequests = bootstrapData.pullRequests
  const pullRequests = allPullRequests.filter(needsSync)
  const total = pullRequests.length

  console.log(
    `Starting background sync for ${total}/${allPullRequests.length} PRs needing updates`
  )

  const task = taskManager.createTask('syncPullRequestDetails', {
    message: 'Synchronizing pull requests...',
    metadata: { totalPullRequests: total }
  })

  taskManager.startTask(task.id)
  taskManager.updateTaskProgress(task.id, {
    current: 0,
    total,
    message: `Syncing 0/${total} pull requests`
  })

  let completed = 0
  const errors: string[] = []

  for (const pullRequest of pullRequests) {
    try {
      await syncPullRequestDetails({
        token,
        pullRequestId: pullRequest.id,
        owner: pullRequest.repositoryOwner,
        repositoryName: pullRequest.repositoryName,
        pullNumber: pullRequest.number
      })

      mainWindow?.webContents.send(ipcChannels.SyncComplete, {
        type: 'pull-request-details',
        pullRequestId: pullRequest.id
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`PR #${pullRequest.number}: ${message}`)
      console.error(
        `Failed to sync details for PR #${pullRequest.number}:`,
        error
      )
    }

    completed++

    taskManager.updateTaskProgress(task.id, {
      current: completed,
      total,
      message: `Syncing ${completed}/${total} pull requests`
    })
  }

  if (errors.length > 0) {
    taskManager.failTask(
      task.id,
      `${errors.length} pull requests failed to sync`
    )
  } else {
    taskManager.completeTask(task.id)
  }

  console.log('Background sync for all PR details completed')
}

app.on('ready', async () => {
  setupIpcHandlers()

  // Initialize database before anything else
  await initializeDatabase()

  await startApiServer(loadToken)

  bootstrapData = await bootstrap()

  createWindow()

  // Start background syncer
  backgroundSyncer.start(loadToken)

  const token = loadToken()

  if (token) {
    const syncTask = taskManager.createTask('syncPullRequests', {
      message: 'Synchronizing pull requests...'
    })

    taskManager.startTask(syncTask.id)

    syncPullRequests(token)
      .then(async (result) => {
        taskManager.completeTask(syncTask.id)

        console.log(`Synced ${result.synced} pull requests`)

        if (result.errors.length > 0) {
          console.warn('Sync warnings:', result.errors)
        }

        bootstrapData = await bootstrap()

        mainWindow?.webContents.send(ipcChannels.SyncComplete, {
          type: 'pull-requests'
        })

        syncAllPullRequestDetails(token).catch((error) => {
          console.error('Failed to sync PR details:', error)
        })
      })
      .catch((error) => {
        taskManager.failTask(
          syncTask.id,
          error instanceof Error ? error.message : 'Unknown error'
        )
        console.error('Failed to sync pull requests:', error)
      })
  }
})

// Save database periodically (every 30 seconds)
setInterval(() => {
  saveDatabase()
}, 30000)

// Save database before quitting
app.on('before-quit', () => {
  backgroundSyncer.stop()
  closeDatabase()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
