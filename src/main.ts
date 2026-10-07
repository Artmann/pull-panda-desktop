import {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
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
import { pullRequests } from './database/schema'
import { ipcChannels } from './lib/ipc/channels'
import {
  getApiPort,
  setApiMainWindow,
  startApiServer,
  stopApiServer
} from './main/api'
import {
  bootstrap,
  type BootstrapData,
  loadPullRequestList
} from './main/bootstrap'
import {
  ListSyncScheduler,
  type RateLimitBudget,
  windowStateOf
} from './main/list-sync-scheduler'
import { needsSync, syncPriority } from './main/needs-sync'
import {
  getCachedUserLogin,
  sendPullRequestResourceEvents,
  setCachedUserLogin
} from './main/send-resource-events'
import { setManualSyncHandler } from './main/sync-requests'
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
import { RateLimitTracker } from './sync/services/rate-limit-tracker'
import type { RequestKind } from './sync/errors'
import type { SyncResult } from './sync/schemas/domain'
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

// Built during startup so the first window load doesn't wait for it. Later
// requests (a renderer reload) build fresh data instead of reusing it.
let pendingBootstrap: Promise<BootstrapData> | null = null
let mainWindow: BrowserWindow | null = null

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

  handleWithSpan(ipcChannels.GetBootstrapData, () => {
    const data = pendingBootstrap ?? bootstrap(getCachedUserLogin())

    pendingBootstrap = null

    return data
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

  // Clear the module-level reference and TaskManager handle when the window
  // closes. Otherwise late-firing timers (e.g. the periodic PR sync) keep
  // dereferencing a destroyed BrowserWindow and crash with "Object has been
  // destroyed" on the next `.webContents.send`.
  mainWindow.on('closed', () => {
    mainWindow = null
    taskManager.setMainWindow(null)
  })

  // Sync when the user comes back to the app, and let the per-PR syncer
  // slow down while the window is in the background.
  mainWindow.on('focus', () => {
    setSyncerWindowFocused(true)
    listSyncScheduler.requestSync()
  })

  mainWindow.on('blur', () => {
    setSyncerWindowFocused(false)
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

type PullRequestRow = typeof pullRequests.$inferSelect

async function syncOnePullRequestDetail(
  pullRequest: PullRequestRow,
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

  await notifyPullRequestList()

  console.log(
    `Removed ${deletedPullRequestIds.length} inaccessible PRs from the list`
  )
}

// Reads the current GitHub budget for one API. Returns null when nothing is
// known yet or the reported window has already reset.
async function readBudget(kind: RequestKind): Promise<RateLimitBudget | null> {
  const runtime = tryGetAppRuntime()

  if (!runtime) {
    return null
  }

  const snapshot = await runtime.runPromise(
    Effect.flatMap(RateLimitTracker, (tracker) => tracker.snapshot(kind))
  )

  if (!snapshot || snapshot.resetAt * 1000 < Date.now()) {
    return null
  }

  return snapshot
}

function isBudgetLow(budget: RateLimitBudget | null): boolean {
  return budget !== null && budget.remaining < budget.limit * 0.1
}

// PRs due for a details sync, most urgent first. When the REST budget is
// nearly spent, only PRs that have never been synced (new ones) go ahead.
function loadDetailSyncCandidates(
  activePullRequestIds: Set<string>,
  onlyNew: boolean
): PullRequestRow[] {
  return getDatabase()
    .select()
    .from(pullRequests)
    .all()
    .filter((row) => needsSync(row, activePullRequestIds))
    .filter((row) => !onlyNew || syncPriority(row) === 0)
    .sort((a, b) => syncPriority(a) - syncPriority(b))
}

let detailSyncInFlight = false
let detailSyncRerunRequested = false

// Runs detail passes one at a time. A request that arrives during a pass
// starts another pass once it finishes, so newly found PRs are not skipped.
async function syncAllPullRequestDetails(): Promise<void> {
  if (detailSyncInFlight) {
    detailSyncRerunRequested = true

    return
  }

  detailSyncInFlight = true

  try {
    do {
      detailSyncRerunRequested = false
      await runDetailSyncPass()
    } while (detailSyncRerunRequested)
  } finally {
    detailSyncInFlight = false
  }
}

async function runDetailSyncPass(): Promise<void> {
  const runtime = getAppRuntime()
  const activePullRequestIds = await runtime.runPromise(
    Effect.flatMap(BackgroundSyncer, (syncer) => syncer.getActivePullRequestIds)
  )

  const restBudget = await readBudget('rest')
  const candidates = loadDetailSyncCandidates(
    activePullRequestIds,
    isBudgetLow(restBudget)
  )
  const total = candidates.length

  if (total === 0) {
    return
  }

  console.log(`Starting background sync for ${total} PRs needing updates`)

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

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)

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

// Returns the signed-in user's login. It only asks GitHub when nothing is
// cached, since syncs run every few seconds and the login rarely changes.
async function getUserLogin(): Promise<string | undefined> {
  return getCachedUserLogin() ?? fetchUserLogin()
}

async function fetchUserLogin(): Promise<string | undefined> {
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
  setupIpcHandlers()

  await initializeDatabase()
  await initializeTelemetry()

  const runtime = initializeAppRuntime(loadToken)

  await startApiServer(loadToken)

  return runtime
}

// Start the background syncer fiber via the runtime, then start the list sync
// scheduler, which runs its first sync right away.
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

  setManualSyncHandler(() => {
    showNextListSyncTask = true
    listSyncScheduler.requestSync()
  })

  // A laptop waking up has usually missed changes, so sync right away.
  powerMonitor.on('resume', () => {
    listSyncScheduler.requestSync()
  })
  powerMonitor.on('unlock-screen', () => {
    listSyncScheduler.requestSync()
  })

  listSyncScheduler.start()
}

app.on('ready', async () => {
  // macOS shows the dock icon from the app bundle in packaged builds, but
  // unpackaged dev builds need it set explicitly.
  if (developmentIconPath && process.platform === 'darwin') {
    app.dock?.setIcon(developmentIconPath)
  }

  const runtime = await initializeServices()

  const userLogin = await getUserLogin()
  pendingBootstrap = bootstrap(userLogin)

  createWindow()

  if (mainWindow) {
    setApiMainWindow(mainWindow)
  }

  await startBackgroundSync(runtime)

  startUsagePingScheduler()
})

let staleSyncInFlight = false
let lastSearchSyncedIds: Set<string> = new Set()
let lastStaleSyncAt = 0
// Set by a manual refresh so that run shows up in the footer. Timed runs
// happen every few seconds and stay silent.
let showNextListSyncTask = false

// A full stale sweep re-reads every local open PR that the search no longer
// returns. It runs at once when a PR drops out of the search (it was likely
// merged or closed), and otherwise only every few minutes.
const staleSyncIntervalMs = 5 * 60 * 1000

function setSyncerWindowFocused(isFocused: boolean): void {
  tryGetAppRuntime()
    ?.runPromise(
      Effect.flatMap(BackgroundSyncer, (syncer) =>
        syncer.setWindowFocused(isFocused)
      )
    )
    .catch((error) => {
      console.error('Failed to update the syncer focus state:', error)
    })
}

// Sends the pull request list (without details) to the renderer.
async function notifyPullRequestList(): Promise<void> {
  const userLogin = await getUserLogin()

  mainWindow?.webContents.send(ipcChannels.ResourceUpdated, {
    type: 'pull-requests',
    data: loadPullRequestList(userLogin)
  })
}

function shouldRunStaleSync(syncedIds: ReadonlySet<string>): boolean {
  const hasDroppedIds = Array.from(lastSearchSyncedIds).some(
    (id) => !syncedIds.has(id)
  )

  return hasDroppedIds || Date.now() - lastStaleSyncAt > staleSyncIntervalMs
}

interface ListSyncTask {
  complete: () => void
  fail: (message: string) => void
}

const silentListSyncTask: ListSyncTask = {
  complete: () => undefined,
  fail: () => undefined
}

// Starts a footer task for a manual refresh. Timed runs stay silent.
function startListSyncTask(): ListSyncTask {
  if (!showNextListSyncTask) {
    return silentListSyncTask
  }

  showNextListSyncTask = false

  const task = taskManager.createTask('syncPullRequests', {
    message: 'Synchronizing pull requests...'
  })

  taskManager.startTask(task.id)

  return {
    complete: () => taskManager.completeTask(task.id),
    fail: (message) => taskManager.failTask(task.id, message)
  }
}

async function handleListSyncResult(result: SyncResult): Promise<void> {
  if (result.errors.length > 0) {
    console.warn('Sync warnings:', result.errors)
  }

  const runStale = shouldRunStaleSync(result.syncedIds)

  lastSearchSyncedIds = result.syncedIds

  // Rebuilding and sending the list makes the renderer re-render, so only
  // do it when the list actually changed.
  if (result.hasChanges) {
    console.log(`Synced ${result.synced} pull requests`)

    await notifyPullRequestList()
  }

  mainWindow?.webContents.send(ipcChannels.SyncComplete)

  // Stale handling can sleep on rate limits, so it runs on its own
  // in-flight flag and never blocks the main poll cycle.
  if (runStale) {
    runStaleSync().catch((error) => {
      console.error('Failed to run stale sync:', error)
    })
  }

  syncAllPullRequestDetails().catch((error) => {
    console.error('Failed to sync PR details:', error)
  })
}

async function runPullRequestSync(): Promise<void> {
  if (!loadToken()) {
    return
  }

  const task = startListSyncTask()

  try {
    const result = await getAppRuntime().runPromise(syncPullRequests)

    task.complete()

    await handleListSyncResult(result)
  } catch (error) {
    task.fail(errorMessageOf(error))

    console.error('Failed to sync pull requests:', error)
  }
}

const listSyncScheduler = new ListSyncScheduler({
  getBudget: () => readBudget('graphql'),
  getWindowState: () => windowStateOf(mainWindow),
  run: runPullRequestSync
})

async function runStaleSync(): Promise<void> {
  if (staleSyncInFlight) {
    return
  }

  staleSyncInFlight = true
  lastStaleSyncAt = Date.now()

  try {
    const runtime = getAppRuntime()
    const staleUpdated = await runtime.runPromise(
      syncStalePullRequests(lastSearchSyncedIds)
    )

    if (staleUpdated > 0) {
      console.log(`Updated ${staleUpdated} stale pull requests`)

      await notifyPullRequestList()
    }
  } catch (error) {
    console.error('Failed to sync stale pull requests:', error)
  } finally {
    staleSyncInFlight = false
  }
}

// Save database periodically (every 30 seconds). Skipped when nothing was
// written since the last save.
setInterval(() => {
  saveDatabase()
}, 30000)

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
  listSyncScheduler.stop()

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
