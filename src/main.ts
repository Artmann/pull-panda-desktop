import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import started from 'electron-squirrel-startup'
import { Octokit } from '@octokit/rest'
import { ipcChannels } from './lib/ipc/channels'
import { bootstrap, BootstrapData, getPullRequestDetails } from './main/bootstrap'
import { syncPullRequests } from './sync/pullRequests'
import { syncPullRequestDetails } from './sync/syncPullRequestDetails'
import type {
  DeviceCodeResponse,
  TokenResponse,
  TokenErrorResponse
} from './types/auth'

let bootstrapData: BootstrapData | null = null
let mainWindow: BrowserWindow | null = null

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = 'Ov23liTdCH6GSo575kz2'
const GITHUB_SCOPES = 'repo read:user'

// Token storage path
const getTokenPath = () =>
  path.join(app.getPath('userData'), 'github-token.enc')

function saveToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available')
  }

  const encrypted = safeStorage.encryptString(token)

  fs.writeFileSync(getTokenPath(), encrypted)
}

function loadToken(): string | null {
  const tokenPath = getTokenPath()

  if (!fs.existsSync(tokenPath)) {
    return null
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return null
  }

  try {
    const encrypted = fs.readFileSync(tokenPath)

    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

function clearToken(): void {
  const tokenPath = getTokenPath()

  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath)
  }
}

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch('https://github.com/login/device/code', {
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: GITHUB_SCOPES
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error(`Failed to request device code: ${response.statusText}`)
  }

  return response.json()
}

async function pollForToken(
  deviceCode: string,
  interval: number
): Promise<TokenResponse> {
  const poll = async (): Promise<TokenResponse> => {
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST'
      }
    )

    const data = (await response.json()) as TokenResponse | TokenErrorResponse

    if ('error' in data) {
      if (data.error === 'authorization_pending') {
        // User hasn't authorized yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, interval * 1000))

        return poll()
      } else if (data.error === 'slow_down') {
        // Rate limited, increase interval
        await new Promise((resolve) =>
          setTimeout(resolve, (interval + 5) * 1000)
        )

        return poll()
      } else if (data.error === 'expired_token') {
        throw new Error('Device code expired. Please try again.')
      } else if (data.error === 'access_denied') {
        throw new Error('Access denied by user.')
      } else {
        throw new Error(data.error_description || data.error)
      }
    }

    return data
  }

  return poll()
}

async function getGitHubUser(token: string) {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.users.getAuthenticated()

  return {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle(ipcChannels.GetBootstrapData, () => {
    return bootstrapData
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
async function syncAllPullRequestDetails(token: string): Promise<void> {
  if (!bootstrapData) {
    return
  }

  console.log(
    `Starting background sync for ${bootstrapData.pullRequests.length} PRs`
  )

  for (const pullRequest of bootstrapData.pullRequests) {
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
      console.error(
        `Failed to sync details for PR #${pullRequest.number}:`,
        error
      )
    }
  }

  console.log('Background sync for all PR details completed')
}

app.on('ready', async () => {
  setupIpcHandlers()

  bootstrapData = await bootstrap()

  createWindow()

  const token = loadToken()

  if (token) {
    syncPullRequests(token)
      .then(async (result) => {
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
        console.error('Failed to sync pull requests:', error)
      })
  }
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
