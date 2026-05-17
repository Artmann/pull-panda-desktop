import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

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

function getTokenPath(): string {
  return path.join(app.getPath('userData'), 'github-token.enc')
}

function getPlainTokenPath(): string {
  return path.join(app.getPath('userData'), 'github-token.txt')
}

// Synchronous token reader used as the runtime's TokenProvider callback. The
// runtime needs a non-Effect source, so this stays a plain function. All
// other auth concerns (device flow, token persistence, user lookup) live in
// the AuthStore / GitHubAuth services.
export function loadToken(): string | null {
  if (safeStorage.isEncryptionAvailable()) {
    const tokenPath = getTokenPath()

    if (fs.existsSync(tokenPath)) {
      try {
        const encrypted = fs.readFileSync(tokenPath)

        return safeStorage.decryptString(encrypted)
      } catch {
        return null
      }
    }
  }

  const plainPath = getPlainTokenPath()

  if (fs.existsSync(plainPath)) {
    try {
      return fs.readFileSync(plainPath, 'utf-8').trim()
    } catch {
      return null
    }
  }

  return null
}
