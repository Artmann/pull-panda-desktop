import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from 'react'
import type { AuthStatus, GitHubUser } from '@/types/auth'

interface AuthContextValue {
  status: AuthStatus
  user: GitHubUser | null
  userCode: string | null
  verificationUri: string | null
  error: string | null
  startLogin: () => Promise<void>
  logout: () => Promise<void>
  openVerificationUrl: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [userCode, setUserCode] = useState<string | null>(null)
  const [verificationUri, setVerificationUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceCode, setDeviceCode] = useState<string | null>(null)
  const [pollInterval, setPollInterval] = useState<number>(5)

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const existingUser = await window.auth.getUser()
        if (existingUser) {
          setUser(existingUser)
          setStatus('authenticated')
        } else {
          setStatus('idle')
        }
      } catch {
        setStatus('idle')
      }
    }
    checkAuth()
  }, [])

  // Poll for token when we have a device code
  useEffect(() => {
    if (status !== 'polling' || !deviceCode) return

    let cancelled = false

    const poll = async () => {
      try {
        await window.auth.pollForToken(deviceCode, pollInterval)
        if (cancelled) return

        // Token received, get user info
        const authenticatedUser = await window.auth.getUser()
        if (cancelled) return

        setUser(authenticatedUser)
        setStatus('authenticated')
        setUserCode(null)
        setVerificationUri(null)
        setDeviceCode(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setStatus('error')
      }
    }

    poll()

    return () => {
      cancelled = true
    }
  }, [status, deviceCode, pollInterval])

  const startLogin = useCallback(async () => {
    setStatus('requesting')
    setError(null)

    try {
      const response = await window.auth.requestDeviceCode()
      setUserCode(response.user_code)
      setVerificationUri(response.verification_uri)
      setDeviceCode(response.device_code)
      setPollInterval(response.interval)
      setStatus('polling')

      // Automatically open the verification URL
      await window.auth.openUrl(response.verification_uri)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login')
      setStatus('error')
    }
  }, [])

  const logout = useCallback(async () => {
    await window.auth.clearToken()
    setUser(null)
    setStatus('idle')
    setUserCode(null)
    setVerificationUri(null)
    setDeviceCode(null)
    setError(null)
  }, [])

  const openVerificationUrl = useCallback(async () => {
    if (verificationUri) {
      await window.auth.openUrl(verificationUri)
    }
  }, [verificationUri])

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        userCode,
        verificationUri,
        error,
        startLogin,
        logout,
        openVerificationUrl
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
