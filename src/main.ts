import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import started from 'electron-squirrel-startup'
import { Octokit } from '@octokit/rest'
import { IPC_CHANNELS } from './lib/ipc/channels'
import { syncPullRequests } from './sync/pullRequests'
import type {
  DeviceCodeResponse,
  TokenResponse,
  TokenErrorResponse
} from './types/auth'

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

// Save encrypted token
function saveToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available')
  }
  const encrypted = safeStorage.encryptString(token)
  fs.writeFileSync(getTokenPath(), encrypted)
}

// Load and decrypt token
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

// Clear token
function clearToken(): void {
  const tokenPath = getTokenPath()
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath)
  }
}

// Request device code from GitHub
async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: GITHUB_SCOPES
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to request device code: ${response.statusText}`)
  }

  return response.json()
}

// Poll for access token
async function pollForToken(
  deviceCode: string,
  interval: number
): Promise<TokenResponse> {
  const poll = async (): Promise<TokenResponse> => {
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
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

// Get GitHub user info
async function getGitHubUser(token: string) {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.users.getAuthenticated()
  return {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name
  }
}

// Set up IPC handlers
function setupIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_REQUEST_DEVICE_CODE, async () => {
    return requestDeviceCode()
  })

  ipcMain.handle(
    IPC_CHANNELS.AUTH_POLL_TOKEN,
    async (_event, deviceCode: string, interval: number) => {
      const tokenResponse = await pollForToken(deviceCode, interval)
      saveToken(tokenResponse.access_token)
      return { success: true }
    }
  )

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_TOKEN, async () => {
    return loadToken()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_CLEAR_TOKEN, async () => {
    clearToken()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_OPEN_URL, async (_event, url: string) => {
    await shell.openExternal(url)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_USER, async () => {
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
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
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
app.on('ready', () => {
  setupIpcHandlers()
  createWindow()

  const token = loadToken()

  if (token) {
    syncPullRequests(token)
      .then((result) => {
        console.log(`Synced ${result.synced} pull requests`)

        if (result.errors.length > 0) {
          console.warn('Sync warnings:', result.errors)
        }
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
