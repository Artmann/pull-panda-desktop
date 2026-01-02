import { Octokit } from '@octokit/rest'
import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface AuthState {
  status: AuthStatus
  userCode?: string
  verificationUri?: string
  expiresAt?: number
  error?: string
  isAuthenticated: boolean
}

export type AuthStatus =
  | 'authenticated'
  | 'error'
  | 'idle'
  | 'loading'
  | 'polling'
  | 'requesting'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface GitHubUser {
  avatar_url: string
  login: string
  name: string | null
}

export interface TokenErrorResponse {
  error: string
  error_description: string
  error_uri?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
}

const gitHubClientId = 'Ov23liTdCH6GSo575kz2'
const gitHubScopes = 'repo read:user'

function getTokenPath(): string {
  return path.join(app.getPath('userData'), 'github-token.enc')
}

export function clearToken(): void {
  const tokenPath = getTokenPath()

  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath)
  }
}

export async function getGitHubUser(token: string) {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.users.getAuthenticated()

  return {
    avatar_url: data.avatar_url,
    login: data.login,
    name: data.name
  }
}

export function loadToken(): string | null {
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

export async function pollForToken(
  deviceCode: string,
  interval: number
): Promise<TokenResponse> {
  const poll = async (): Promise<TokenResponse> => {
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        body: JSON.stringify({
          client_id: gitHubClientId,
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

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch('https://github.com/login/device/code', {
    body: JSON.stringify({
      client_id: gitHubClientId,
      scope: gitHubScopes
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

export function saveToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available')
  }

  const encrypted = safeStorage.encryptString(token)

  fs.writeFileSync(getTokenPath(), encrypted)
}
