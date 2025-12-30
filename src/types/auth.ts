export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
}

export interface TokenErrorResponse {
  error: string
  error_description: string
  error_uri?: string
}

export type AuthStatus =
  | 'loading'
  | 'idle'
  | 'requesting'
  | 'polling'
  | 'authenticated'
  | 'error'

export interface AuthState {
  status: AuthStatus
  userCode?: string
  verificationUri?: string
  expiresAt?: number
  error?: string
  isAuthenticated: boolean
}

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
}
