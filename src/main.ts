import { app, BrowserWindow, ipcMain, shell } from 'electron'
import started from 'electron-squirrel-startup'
import path from 'node:path'

import { initializeDatabase, closeDatabase, saveDatabase } from './database'
import { ipcChannels } from './lib/ipc/channels'
import { getApiPort, startApiServer } from './main/api'
import { bootstrap, BootstrapData } from './main/bootstrap'
import { sendPullRequestResourceEvents } from './main/send-resource-events'
import { backgroundSyncer } from './main/background-syncer'
import { taskManager } from './main/task-manager'
import { deletePullRequestData } from './sync/delete-pull-request'
import { syncPullRequests, syncStalePullRequests } from './sync/pull-requests'
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
let isSyncingPullRequests = false
let isSyncingDetails = false
let pullRequestSyncIntervalId: NodeJS.Timeout | null = null
let detailSyncIntervalId: NodeJS.Timeout | null = null

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

  ipcMain.handle(ipcChannels.GetSyncerStats, () => {
    return backgroundSyncer.getMonitoringData()
  })
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
function needsSync(
  pullRequest: {
    id: string
    detailsSyncedAt: string | null
    state: string
    updatedAt: string
  },
  activePullRequestIds: Set<string>
): boolean {
  // Merged or closed PRs don't need periodic syncing
  if (pullRequest.state === 'MERGED' || pullRequest.state === 'CLOSED') {
    return false
  }

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

  // Active PRs (user has opened them) sync every 10 seconds
  if (activePullRequestIds.has(pullRequest.id)) {
    return now - detailsSyncedAt > 10_000
  }

  // Recently updated open PRs sync every 60 seconds
  const oneDayMs = 24 * 60 * 60 * 1000
  const isRecentlyUpdated = now - updatedAt < oneDayMs

  if (isRecentlyUpdated) {
    return now - detailsSyncedAt > 60_000
  }

  // Older open PRs sync every 5 minutes
  return now - detailsSyncedAt > 5 * 60_000
}

async function syncAllPullRequestDetails(token: string): Promise<void> {
  if (!bootstrapData) {
    return
  }

  const allPullRequests = bootstrapData.pullRequests
  const activePullRequestIds = backgroundSyncer.getActivePullRequestIds()
  const pullRequests = allPullRequests.filter((pr) =>
    needsSync(pr, activePullRequestIds)
  )
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

  const currentUserLogin = await getUserLogin()

  const deletedPullRequestIds: string[] = []

  const batchSize = 5

  for (let i = 0; i < pullRequests.length; i += batchSize) {
    const batch = pullRequests.slice(i, i + batchSize)

    await Promise.allSettled(
      batch.map(async (pullRequest) => {
        try {
          const result = await syncPullRequestDetails({
            token,
            pullRequestId: pullRequest.id,
            owner: pullRequest.repositoryOwner,
            repositoryName: pullRequest.repositoryName,
            pullNumber: pullRequest.number
          })

          if (result.notFound) {
            deletePullRequestData(pullRequest.id)
            deletedPullRequestIds.push(pullRequest.id)
          } else if (mainWindow) {
            await sendPullRequestResourceEvents(
              mainWindow,
              pullRequest.id,
              currentUserLogin
            )
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          errors.push(`PR #${pullRequest.number}: ${message}`)
          console.error(
            `Failed to sync details for PR #${pullRequest.number}:`,
            error
          )
        } finally {
          completed++

          taskManager.updateTaskProgress(task.id, {
            current: completed,
            total,
            message: `Syncing ${completed}/${total} pull requests`
          })
        }
      })
    )
  }

  // If any PRs were deleted, send the updated list to the renderer
  if (deletedPullRequestIds.length > 0 && mainWindow) {
    const postDeleteUserLogin = await getUserLogin()
    bootstrapData = await bootstrap(postDeleteUserLogin)

    mainWindow.webContents.send(ipcChannels.ResourceUpdated, {
      type: 'pull-requests',
      data: bootstrapData.pullRequests
    })

    console.log(
      `Removed ${deletedPullRequestIds.length} inaccessible PRs from the list`
    )
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

async function getUserLogin(): Promise<string | undefined> {
  const token = loadToken()

  if (!token) {
    return undefined
  }

  try {
    const user = await getGitHubUser(token)

    return user?.login
  } catch {
    return undefined
  }
}

async function runPullRequestSync(): Promise<void> {
  const token = loadToken()

  if (!token || isSyncingPullRequests) {
    return
  }

  isSyncingPullRequests = true

  try {
    const result = await syncPullRequests(token)

    console.log(`Synced ${result.synced} pull requests`)

    if (result.errors.length > 0) {
      console.warn('Sync warnings:', result.errors)
    }

    // Update stale PRs that were merged/closed on GitHub
    try {
      const staleUpdated = await syncStalePullRequests(token, result.syncedIds)

      if (staleUpdated > 0) {
        console.log(`Updated ${staleUpdated} stale pull requests`)
      }
    } catch (error) {
      console.error('Failed to sync stale pull requests:', error)
    }

    // Rebuild bootstrap data for future IPC GetBootstrapData calls
    const postSyncUserLogin = await getUserLogin()
    bootstrapData = await bootstrap(postSyncUserLogin)

    // Send the fresh PR list to the renderer
    mainWindow?.webContents.send(ipcChannels.ResourceUpdated, {
      type: 'pull-requests',
      data: bootstrapData.pullRequests
    })
    mainWindow?.webContents.send(ipcChannels.SyncComplete)
  } catch (error) {
    console.error('Failed to sync pull requests:', error)
  } finally {
    isSyncingPullRequests = false
  }
}

async function runDetailSync(): Promise<void> {
  const token = loadToken()

  if (!token || isSyncingDetails) {
    return
  }

  isSyncingDetails = true

  try {
    await syncAllPullRequestDetails(token)
  } catch (error) {
    console.error('Failed to sync PR details:', error)
  } finally {
    isSyncingDetails = false
  }
}

app.on('ready', async () => {
  setupIpcHandlers()

  // Initialize database before anything else
  await initializeDatabase()

  await startApiServer(loadToken)

  const userLogin = await getUserLogin()
  bootstrapData = await bootstrap(userLogin)

  createWindow()

  // Start background syncer
  backgroundSyncer.start(loadToken)

  const token = loadToken()

  if (token) {
    const syncTask = taskManager.createTask('syncPullRequests', {
      message: 'Synchronizing pull requests...'
    })

    taskManager.startTask(syncTask.id)

    runPullRequestSync()
      .then(() => {
        taskManager.completeTask(syncTask.id)

        // Run initial detail sync
        runDetailSync().catch((error) => {
          console.error('Failed to sync PR details:', error)
        })

        // Start periodic syncs
        pullRequestSyncIntervalId = setInterval(runPullRequestSync, 3000)
        detailSyncIntervalId = setInterval(runDetailSync, 10_000)
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
  if (pullRequestSyncIntervalId) {
    clearInterval(pullRequestSyncIntervalId)
  }

  if (detailSyncIntervalId) {
    clearInterval(detailSyncIntervalId)
  }

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
