import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  screen,
  shell,
  type IpcMainInvokeEvent
} from 'electron'
import { Effect } from 'effect'
import started from 'electron-squirrel-startup'
import path from 'node:path'

import {
  closeDatabase,
  getDatabase,
  initializeDatabase,
  saveDatabase
} from './database'
import { ipcChannels } from './lib/ipc/channels'
import { detectAgents } from './main/agents/agent-detection'
import {
  loadAgentSettings,
  setAgentOverride,
  setDefaultAgent,
  type AgentId
} from './main/agents/agent-settings'
import {
  getApiPort,
  setApiMainWindow,
  startApiServer,
  stopApiServer
} from './main/api'
import { bootstrap, BootstrapData } from './main/bootstrap'
import { chatManager, type ChatSendParams } from './main/chat/chat-manager'
import { getMessages, getSessions } from './main/chat/chat-store'
import { needsSync } from './main/needs-sync'
import {
  sendPullRequestResourceEvents,
  setCachedUserLogin
} from './main/send-resource-events'
import { taskManager } from './main/task-manager'
import { startUsagePingScheduler } from './main/usage-ping'
import {
  isUsageReportingEnabled,
  setUsageReportingEnabled
} from './main/usage-settings'
import { deletePullRequestData } from './sync/operations/delete-pull-request'
import {
  syncPullRequests,
  syncStalePullRequests
} from './sync/operations/sync-pull-requests'
import { syncPullRequestDetails } from './sync/operations/sync-pull-request-details'
import {
  disposeAppRuntime,
  getAppRuntime,
  initializeAppRuntime,
  tryGetAppRuntime
} from './sync/runtime'
import { BackgroundSyncer } from './sync/services/background-syncer'
import { initializeTelemetry, shutdownTelemetry } from './telemetry/lifecycle'
import { withSpan } from './telemetry/span'
import { getTelemetryStore } from './telemetry/store'
import type {
  QueryLogsParams,
  QueryTracesParams,
  TelemetryBatch
} from './telemetry/types'
import { loadToken } from './auth'
import {
  clearStoredToken,
  getCurrentUser,
  loadStoredToken,
  pollForTokenOperation,
  requestDeviceCodeOperation
} from './main/api/operations/auth'

let bootstrapData: BootstrapData | null = null
let mainWindow: BrowserWindow | null = null

// The window is created before the database and services finish initializing,
// so the renderer's first request (GetBootstrapData) must wait until the data
// is actually ready. Everything else the renderer calls happens after that.
let markBootstrapReady = (): void => {
  return
}

const bootstrapReady = new Promise<void>((resolve) => {
  markBootstrapReady = resolve
})

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

// In packaged builds the OS uses the icon baked in by Electron Forge
// (`packagerConfig.icon`). When running unpackaged (e.g. `yarn start` or via
// npx) that icon is not applied, so Electron falls back to its default icon.
// Point at the icon files in the project root so dev builds show the Pull
// Panda icon in the taskbar and dock.
const developmentIconPath = app.isPackaged
  ? null
  : path.join(
      app.getAppPath(),
      process.platform === 'win32' ? 'icon.ico' : 'icon.png'
    )

// Unpackaged dev builds report the app name as "Electron" (it comes from the
// Electron binary's bundle, not package.json), which shows up in the dock
// tooltip and menu bar. Set it explicitly so dev matches the packaged name.
if (!app.isPackaged) {
  app.setName('Pull Panda')
}

app.commandLine.appendSwitch('font-render-hinting', 'none')

// Registers an IPC handler whose invocation is recorded as a telemetry span, so
// the time spent handling each renderer request shows up in the dashboard.
function handleWithSpan<Args extends unknown[], Result>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Result
): void {
  ipcMain.handle(channel, (event, ...args: Args) =>
    withSpan(
      `ipc ${channel}`,
      { kind: 'server', attributes: { 'ipc.channel': channel } },
      () => handler(event, ...args)
    )
  )
}

function setupIpcHandlers(): void {
  handleWithSpan(ipcChannels.ApiGetPort, () => {
    return getApiPort()
  })

  handleWithSpan(ipcChannels.GetBootstrapData, async () => {
    await bootstrapReady

    return bootstrapData
  })

  handleWithSpan(ipcChannels.GetTasks, () => {
    return taskManager.getTasks()
  })

  handleWithSpan(ipcChannels.AuthRequestDeviceCode, () => {
    const runtime = getAppRuntime()

    return runtime.runPromise(requestDeviceCodeOperation)
  })

  handleWithSpan(
    ipcChannels.AuthPollToken,
    (_event, deviceCode: string, interval: number) => {
      const runtime = getAppRuntime()

      return runtime.runPromise(pollForTokenOperation({ deviceCode, interval }))
    }
  )

  handleWithSpan(ipcChannels.AuthGetToken, () => {
    const runtime = getAppRuntime()

    return runtime.runPromise(loadStoredToken)
  })

  handleWithSpan(ipcChannels.AuthClearToken, () => {
    const runtime = getAppRuntime()

    setCachedUserLogin(undefined)

    return runtime.runPromise(clearStoredToken)
  })

  handleWithSpan(ipcChannels.AuthOpenUrl, async (_event, url: string) => {
    await shell.openExternal(url)

    return { success: true }
  })

  handleWithSpan(ipcChannels.OpenUrl, async (_event, url: string) => {
    await shell.openExternal(url)

    return { success: true }
  })

  handleWithSpan(ipcChannels.AuthGetUser, async () => {
    const runtime = getAppRuntime()
    const user = await runtime.runPromise(getCurrentUser)

    setCachedUserLogin(user?.login ?? undefined)

    return user
  })

  handleWithSpan(ipcChannels.WindowClose, () => {
    mainWindow?.close()
  })

  handleWithSpan(ipcChannels.WindowMaximize, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  handleWithSpan(ipcChannels.WindowMinimize, () => {
    mainWindow?.minimize()
  })

  handleWithSpan(ipcChannels.GetSyncerStats, () => {
    const runtime = getAppRuntime()

    return runtime.runPromise(
      Effect.flatMap(BackgroundSyncer, (syncer) => syncer.getMonitoringData)
    )
  })

  handleWithSpan(ipcChannels.UsageGetReportingEnabled, () => {
    return isUsageReportingEnabled()
  })

  handleWithSpan(
    ipcChannels.UsageSetReportingEnabled,
    (_event, enabled: boolean) => {
      setUsageReportingEnabled(enabled)
    }
  )

  handleWithSpan(ipcChannels.AgentsDetect, () => {
    return detectAgents(loadAgentSettings())
  })

  handleWithSpan(ipcChannels.AgentsGetSettings, () => {
    return loadAgentSettings()
  })

  handleWithSpan(ipcChannels.AgentsPickBinary, async () => {
    if (!mainWindow) {
      return { path: null }
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { path: null }
    }

    return { path: result.filePaths[0] }
  })

  handleWithSpan(
    ipcChannels.AgentsSetDefault,
    (_event, agent: AgentId | null) => {
      return setDefaultAgent(agent)
    }
  )

  handleWithSpan(
    ipcChannels.AgentsSetOverride,
    (_event, agent: AgentId, binaryPath: string | null) => {
      return setAgentOverride(agent, binaryPath)
    }
  )

  handleWithSpan(ipcChannels.ChatGetMessages, (_event, sessionId: string) => {
    return getMessages(getDatabase(), sessionId)
  })

  handleWithSpan(
    ipcChannels.ChatGetSessions,
    (_event, pullRequestId: string) => {
      return getSessions(getDatabase(), pullRequestId)
    }
  )

  handleWithSpan(ipcChannels.ChatSend, (_event, params: ChatSendParams) => {
    return chatManager.send(params)
  })

  handleWithSpan(ipcChannels.ChatStop, (_event, sessionId: string) => {
    chatManager.stop(sessionId)
  })

  // Telemetry handlers are registered directly (not via handleWithSpan) so that
  // observing the telemetry does not itself generate telemetry.
  ipcMain.handle(ipcChannels.TelemetryEnabled, () => {
    return getTelemetryStore() !== null
  })

  ipcMain.handle(
    ipcChannels.TelemetryRecord,
    (_event, batch: TelemetryBatch) => {
      const store = getTelemetryStore()

      if (!store) {
        return
      }

      store.recordSpans(batch.spans)
      store.recordLogs(batch.logs)
    }
  )

  ipcMain.handle(
    ipcChannels.TelemetryQueryTraces,
    (_event, params: QueryTracesParams) => {
      return getTelemetryStore()?.queryTraces(params) ?? []
    }
  )

  ipcMain.handle(ipcChannels.TelemetryGetTrace, (_event, traceId: string) => {
    return (
      getTelemetryStore()?.getTrace(traceId) ?? {
        traceId,
        spans: [],
        logs: []
      }
    )
  })

  ipcMain.handle(
    ipcChannels.TelemetryQueryLogs,
    (_event, params: QueryLogsParams) => {
      return getTelemetryStore()?.queryLogs(params) ?? []
    }
  )

  ipcMain.handle(ipcChannels.TelemetryGetStats, () => {
    return (
      getTelemetryStore()?.stats() ?? {
        traceCount: 0,
        spanCount: 0,
        logCount: 0,
        errorTraceCount: 0,
        operations: []
      }
    )
  })
}

const createWindow = () => {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const margin = 80
  const width = Math.min(1600, Math.max(1200, workAreaSize.width - margin))
  const height = Math.min(1000, Math.max(700, workAreaSize.height - margin))

  mainWindow = new BrowserWindow({
    // Paint the theme's background immediately instead of a white flash while
    // the renderer loads. Values mirror --background in src/app/index.css.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1215' : '#fbfaf8',
    frame: false,
    height,
    ...(developmentIconPath ? { icon: developmentIconPath } : {}),
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      // Dev builds are driven over CDP (agent-browser); with throttling on,
      // Chromium freezes rAF and IntersectionObserver while the window is
      // hidden, which breaks that automation. Packaged builds keep the
      // battery-friendly default.
      backgroundThrottling: app.isPackaged,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
    width
  })

  taskManager.setMainWindow(mainWindow)
  chatManager.setMainWindow(mainWindow)

  // Clear the module-level reference and TaskManager handle when the window
  // closes. Otherwise late-firing timers (e.g. the periodic PR sync) keep
  // dereferencing a destroyed BrowserWindow and crash with "Object has been
  // destroyed" on the next `.webContents.send`.
  mainWindow.on('closed', () => {
    mainWindow = null
    taskManager.setMainWindow(null)
    chatManager.setMainWindow(null)
  })

  mainWindow.on('focus', () => {
    maybeSyncOnFocus()
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

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

async function syncOnePullRequestDetail(
  pullRequest: BootstrapData['pullRequests'][number],
  currentUserLogin: string | undefined,
  deletedPullRequestIds: string[],
  errors: string[]
): Promise<void> {
  const runtime = getAppRuntime()

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
    errors.push(`PR #${pullRequest.number}: ${errorMessageOf(error)}`)
    console.error(
      `Failed to sync details for PR #${pullRequest.number}:`,
      error
    )
  }
}

// If any PRs were deleted, send the updated list to the renderer.
async function notifyDeletedPullRequests(
  deletedPullRequestIds: string[]
): Promise<void> {
  if (deletedPullRequestIds.length === 0 || !mainWindow) {
    return
  }

  await rebuildBootstrapAndNotify()

  console.log(
    `Removed ${deletedPullRequestIds.length} inaccessible PRs from the list`
  )
}

async function syncAllPullRequestDetails(): Promise<void> {
  if (!bootstrapData) {
    return
  }

  const runtime = getAppRuntime()
  const activePullRequestIds = await runtime.runPromise(
    Effect.flatMap(BackgroundSyncer, (syncer) => syncer.getActivePullRequestIds)
  )

  const allPullRequests = bootstrapData.pullRequests
  const pullRequests = allPullRequests.filter((pullRequest) =>
    needsSync(pullRequest, activePullRequestIds)
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
        await syncOnePullRequestDetail(
          pullRequest,
          currentUserLogin,
          deletedPullRequestIds,
          errors
        )

        completed++

        taskManager.updateTaskProgress(task.id, {
          current: completed,
          total,
          message: `Syncing ${completed}/${total} pull requests`
        })
      })
    )
  }

  await notifyDeletedPullRequests(deletedPullRequestIds)

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
  const runtime = tryGetAppRuntime()

  if (!runtime) {
    return
  }

  const user = await runtime.runPromise(getCurrentUser)
  const login = user?.login ?? undefined

  setCachedUserLogin(login)

  return login
}

// Boot the persistence and service layer in dependency order: the database
// before anything else, telemetry (dev-only) before the runtime so the Effect
// tracer/logger can write spans and logs from the very first sync.
async function initializeServices(): Promise<
  ReturnType<typeof initializeAppRuntime>
> {
  await initializeDatabase()
  await initializeTelemetry()

  const runtime = initializeAppRuntime(loadToken)

  await startApiServer(loadToken)

  return runtime
}

// Start the background syncer fiber via the runtime, then kick off an initial
// pull-request sync when a token is already stored.
async function startBackgroundSync(
  runtime: ReturnType<typeof initializeAppRuntime>
): Promise<void> {
  await runtime.runPromise(
    Effect.flatMap(BackgroundSyncer, (syncer) => syncer.start).pipe(
      Effect.catchAll((error) => {
        console.error('Failed to start background syncer:', error)

        return Effect.void
      })
    )
  )

  if (loadToken()) {
    runPullRequestSync()
  }
}

app.on('ready', async () => {
  // macOS shows the dock icon from the app bundle in packaged builds, but
  // unpackaged dev builds need it set explicitly.
  if (developmentIconPath && process.platform === 'darwin') {
    app.dock?.setIcon(developmentIconPath)
  }

  // Show the window right away — the static splash in index.html is visible
  // while the database, runtime, and bootstrap data load below. The renderer
  // blocks on GetBootstrapData, which resolves once markBootstrapReady runs.
  setupIpcHandlers()
  createWindow()

  if (mainWindow) {
    setApiMainWindow(mainWindow)
  }

  const runtime = await initializeServices()

  const userLogin = await getUserLogin()
  bootstrapData = await bootstrap(userLogin)

  markBootstrapReady()

  await startBackgroundSync(runtime)

  startUsagePingScheduler()
})

let pullRequestSyncInFlight = false
let staleSyncInFlight = false
let lastSearchSyncedIds: Set<string> = new Set()

// Trigger a sync when the window regains focus so the list is fresh exactly
// when the user looks at the app. Debounced so rapid alt-tabbing doesn't fire a
// burst of syncs.
const focusSyncDebounceMs = 15 * 1000
let lastFocusSyncAt = 0

function maybeSyncOnFocus(): void {
  // The window opens (and gains focus) before the services finish
  // initializing; the startup sync covers that window of time.
  if (!tryGetAppRuntime()) {
    return
  }

  const token = loadToken()

  if (!token) {
    return
  }

  const now = Date.now()

  if (now - lastFocusSyncAt < focusSyncDebounceMs) {
    return
  }

  lastFocusSyncAt = now

  runPullRequestSync().catch((error) => {
    console.error('Focus-triggered sync failed:', error)
  })
}

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
    const runtime = getAppRuntime()
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
    taskManager.failTask(syncTask.id, errorMessageOf(error))
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
    const runtime = getAppRuntime()
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
// - Default cadence is 1 min.
// - When the last run produced changes (or there is a focused PR), refresh
//   sooner so the list stays responsive.
// - Otherwise stretch the interval ×1.5 up to a 10 min ceiling.
const minSyncDelayMs = 30 * 1000
const baseSyncDelayMs = 60 * 1000
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

        const runtime = getAppRuntime()
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

  chatManager.dispose()

  const runtime = tryGetAppRuntime()

  if (!runtime) {
    stopApiServer()
    shutdownTelemetry()
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
      disposeAppRuntime().catch((error) => {
        console.error('Failed to dispose sync runtime:', error)
      })
    )
    .finally(() => {
      stopApiServer()
      shutdownTelemetry()
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

// Quit when the parent process (e.g. `electron-forge start`) is killed so
// the Electron window doesn't stay open after Ctrl+C in dev. `app.quit()`
// runs the graceful `before-quit` cleanup; the timeout is a hard fallback
// in case shutdown stalls (e.g. renderer hung after the dev server died).
const handleTerminationSignal = () => {
  app.quit()

  setTimeout(() => {
    process.exit(0)
  }, 2000).unref()
}

process.on('SIGINT', handleTerminationSignal)
process.on('SIGTERM', handleTerminationSignal)
process.on('SIGHUP', handleTerminationSignal)

// In dev, Ctrl+C on `electron-forge start` doesn't always deliver SIGINT to
// the spawned Electron binary, so the window outlives the dev server. Watch
// for the parent process going away (the OS reparents us to PID 1) and exit
// when that happens.
if (!app.isPackaged) {
  const originalParentPid = process.ppid

  setInterval(() => {
    if (process.ppid !== originalParentPid || process.ppid === 1) {
      handleTerminationSignal()
    }
  }, 1000).unref()
}
