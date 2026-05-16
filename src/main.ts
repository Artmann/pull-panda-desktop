import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { Effect } from 'effect'
import started from 'electron-squirrel-startup'
import path from 'node:path'

import { initializeDatabase, closeDatabase, saveDatabase } from './database'
import { ipcChannels } from './lib/ipc/channels'
import {
  getApiPort,
  setApiMainWindow,
  startApiServer,
  stopApiServer
} from './main/api'
import { bootstrap, BootstrapData } from './main/bootstrap'
import { sendPullRequestResourceEvents } from './main/send-resource-events'
import { taskManager } from './main/task-manager'
import { deletePullRequestData } from './sync/operations/delete-pull-request'
import {
  syncPullRequests,
  syncStalePullRequests
} from './sync/operations/sync-pull-requests'
import { syncPullRequestDetails } from './sync/operations/sync-pull-request-details'
import {
  disposeSyncRuntime,
  getSyncRuntime,
  initializeSyncRuntime,
  tryGetSyncRuntime
} from './sync/runtime'
import { BackgroundSyncer } from './sync/services/background-syncer'
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

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

app.commandLine.appendSwitch('font-render-hinting', 'none')

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

  ipcMain.handle(ipcChannels.GetSyncerStats, async () => {
    const runtime = getSyncRuntime()

    return runtime.runPromise(
      Effect.flatMap(BackgroundSyncer, (syncer) => syncer.getMonitoringData)
    )
  })
}

const createWindow = () => {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const margin = 80
  const width = Math.min(1600, Math.max(1200, workAreaSize.width - margin))
  const height = Math.min(1000, Math.max(700, workAreaSize.height - margin))

  mainWindow = new BrowserWindow({
    frame: false,
    height,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
    width
  })

  taskManager.setMainWindow(mainWindow)

  // Clear the module-level reference and TaskManager handle when the window
  // closes. Otherwise late-firing timers (e.g. the periodic PR sync) keep
  // dereferencing a destroyed BrowserWindow and crash with "Object has been
  // destroyed" on the next `.webContents.send`.
  mainWindow.on('closed', () => {
    mainWindow = null
    taskManager.setMainWindow(null)
  })

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

async function syncAllPullRequestDetails(): Promise<void> {
  if (!bootstrapData) {
    return
  }

  const runtime = getSyncRuntime()
  const activePullRequestIds = await runtime.runPromise(
    Effect.flatMap(BackgroundSyncer, (syncer) => syncer.getActivePullRequestIds)
  )

  const allPullRequests = bootstrapData.pullRequests
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
          const result = await runtime.runPromise(
            syncPullRequestDetails({
              pullRequestId: pullRequest.id,
              owner: pullRequest.repositoryOwner,
              repositoryName: pullRequest.repositoryName,
              pullNumber: pullRequest.number
            })
          )

          if (result.notFound) {
            await runtime.runPromise(deletePullRequestData(pullRequest.id))
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
    return
  }

  try {
    const user = await getGitHubUser(token)

    return user?.login
  } catch {
    return
  }
}

app.on('ready', async () => {
  setupIpcHandlers()

  // Initialize database before anything else
  await initializeDatabase()

  // Initialize the sync runtime now that the database is ready.
  const runtime = initializeSyncRuntime(loadToken)

  await startApiServer(loadToken)

  const userLogin = await getUserLogin()
  bootstrapData = await bootstrap(userLogin)

  createWindow()

  if (mainWindow) {
    setApiMainWindow(mainWindow)
  }

  // Start the background syncer fiber via the runtime.
  await runtime.runPromise(
    Effect.flatMap(BackgroundSyncer, (syncer) => syncer.start).pipe(
      Effect.catchAll((error) => {
        console.error('Failed to start background syncer:', error)

        return Effect.void
      })
    )
  )

  const token = loadToken()

  if (token) {
    runPullRequestSync()
  }
})

let pullRequestSyncInFlight = false
let staleSyncInFlight = false
let lastSearchSyncedIds: Set<string> = new Set()

async function rebuildBootstrapAndNotify(): Promise<void> {
  const userLogin = await getUserLogin()
  bootstrapData = await bootstrap(userLogin)

  mainWindow?.webContents.send(ipcChannels.ResourceUpdated, {
    type: 'pull-requests',
    data: bootstrapData.pullRequests
  })
}

async function runPullRequestSync(): Promise<boolean> {
  if (pullRequestSyncInFlight) {
    return false
  }

  pullRequestSyncInFlight = true

  const syncTask = taskManager.createTask('syncPullRequests', {
    message: 'Synchronizing pull requests...'
  })

  taskManager.startTask(syncTask.id)

  try {
    const runtime = getSyncRuntime()
    const result = await runtime.runPromise(syncPullRequests)

    taskManager.completeTask(syncTask.id)

    console.log(`Synced ${result.synced} pull requests`)

    if (result.errors.length > 0) {
      console.warn('Sync warnings:', result.errors)
    }

    lastSearchSyncedIds = result.syncedIds

    await rebuildBootstrapAndNotify()

    mainWindow?.webContents.send(ipcChannels.SyncComplete)

    // Stale handling can sleep on rate limits, so it runs on its own
    // in-flight flag and never blocks the main poll cycle.
    runStaleSync().catch((error) => {
      console.error('Failed to run stale sync:', error)
    })

    syncAllPullRequestDetails().catch((error) => {
      console.error('Failed to sync PR details:', error)
    })

    return result.hasChanges
  } catch (error) {
    taskManager.failTask(
      syncTask.id,
      error instanceof Error ? error.message : 'Unknown error'
    )
    console.error('Failed to sync pull requests:', error)

    return false
  } finally {
    pullRequestSyncInFlight = false
  }
}

async function runStaleSync(): Promise<void> {
  if (staleSyncInFlight) {
    return
  }

  staleSyncInFlight = true

  try {
    const runtime = getSyncRuntime()
    const staleUpdated = await runtime.runPromise(
      syncStalePullRequests(lastSearchSyncedIds)
    )

    if (staleUpdated > 0) {
      console.log(`Updated ${staleUpdated} stale pull requests`)

      await rebuildBootstrapAndNotify()
    }
  } catch (error) {
    console.error('Failed to sync stale pull requests:', error)
  } finally {
    staleSyncInFlight = false
  }
}

// Save database periodically (every 30 seconds)
setInterval(() => {
  saveDatabase()
}, 30000)

// Adaptive cadence for the main PR search:
// - Default cadence is 2 min.
// - When the last run produced changes (or there is a focused PR), refresh
//   sooner so the list stays responsive.
// - Otherwise stretch the interval ×1.5 up to a 10 min ceiling.
const minSyncDelayMs = 30 * 1000
const baseSyncDelayMs = 2 * 60 * 1000
const maxSyncDelayMs = 10 * 60 * 1000
const focusedSyncDelayMs = 60 * 1000

let nextSyncDelayMs = baseSyncDelayMs

function scheduleNextPullRequestSync(): void {
  setTimeout(() => {
    const token = loadToken()

    if (!token) {
      nextSyncDelayMs = baseSyncDelayMs
      scheduleNextPullRequestSync()

      return
    }

    runPullRequestSync()
      .then(async (hasChanges) => {
        if (hasChanges) {
          nextSyncDelayMs = minSyncDelayMs

          return
        }

        const runtime = getSyncRuntime()
        const focusedId = await runtime.runPromise(
          Effect.flatMap(
            BackgroundSyncer,
            (syncer) => syncer.getFocusedPullRequestId
          )
        )

        if (focusedId) {
          nextSyncDelayMs = focusedSyncDelayMs
        } else {
          nextSyncDelayMs = Math.min(
            maxSyncDelayMs,
            Math.max(baseSyncDelayMs, Math.floor(nextSyncDelayMs * 1.5))
          )
        }
      })
      .catch((error) => {
        console.error('Pull request sync iteration failed:', error)
        nextSyncDelayMs = baseSyncDelayMs
      })
      .finally(() => {
        scheduleNextPullRequestSync()
      })
  }, nextSyncDelayMs)
}

scheduleNextPullRequestSync()

// Save database before quitting. The shutdown is async because we need to let
// background sync fibers finish before the database is closed, otherwise an
// in-flight Database.use call can fail or corrupt data on the way out.
let isShuttingDown = false

app.on('before-quit', (event) => {
  if (isShuttingDown) {
    return
  }

  event.preventDefault()
  isShuttingDown = true

  const runtime = tryGetSyncRuntime()

  if (!runtime) {
    stopApiServer()
    closeDatabase()
    app.quit()

    return
  }

  runtime
    .runPromise(
      Effect.flatMap(BackgroundSyncer, (syncer) => syncer.stop).pipe(
        Effect.catchAll(() => Effect.void)
      )
    )
    .catch((error) => {
      console.error('Failed to stop background syncer:', error)
    })
    .then(() =>
      disposeSyncRuntime().catch((error) => {
        console.error('Failed to dispose sync runtime:', error)
      })
    )
    .finally(() => {
      stopApiServer()
      closeDatabase()
      app.quit()
    })
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
