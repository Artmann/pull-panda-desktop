import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitHubAuth, GitHubAuthLive } from './github-auth'

const octokitMocks = vi.hoisted(() => ({
  getAuthenticated: vi.fn()
}))

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    users = { getAuthenticated: octokitMocks.getAuthenticated }
  }
}))

const fetchMock = vi.fn()

const jsonResponse = (body: unknown, ok = true, statusText = 'OK') => ({
  json: () => Promise.resolve(body),
  ok,
  statusText
})

const provide = <A, E>(effect: Effect.Effect<A, E, GitHubAuth>) =>
  Effect.runPromise(Effect.provide(effect, GitHubAuthLive))

const tokenSuccessBody = {
  access_token: 'gho_token',
  scope: 'repo read:user',
  token_type: 'bearer'
}

const expectedAccessToken = {
  accessToken: 'gho_token',
  scope: 'repo read:user',
  tokenType: 'bearer'
}

describe('GitHubAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('requestDeviceCode', () => {
    it('requests a device code and maps the response fields', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          device_code: 'device_123',
          expires_in: 900,
          interval: 5,
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device'
        })
      )

      const result = await provide(
        Effect.flatMap(GitHubAuth, (auth) => auth.requestDeviceCode)
      )

      expect(result).toEqual({
        deviceCode: 'device_123',
        expiresIn: 900,
        interval: 5,
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device'
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://github.com/login/device/code',
        {
          body: JSON.stringify({
            client_id: 'Ov23liTdCH6GSo575kz2',
            scope: 'repo read:user'
          }),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      )
    })

    it('fails with a NetworkError when the response is not ok', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false, 'Bad Gateway'))

      const error = await provide(
        Effect.flip(Effect.flatMap(GitHubAuth, (auth) => auth.requestDeviceCode))
      )

      if (error._tag !== 'NetworkError') {
        throw new Error(`Expected NetworkError, got ${error._tag}`)
      }

      expect({
        cause: error.cause,
        route: error.route
      }).toEqual({
        cause: new Error('Failed to request device code: Bad Gateway'),
        route: 'device/code'
      })
    })

    it('fails with a NetworkError when the request itself rejects', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))

      const error = await provide(
        Effect.flip(Effect.flatMap(GitHubAuth, (auth) => auth.requestDeviceCode))
      )

      if (error._tag !== 'NetworkError') {
        throw new Error(`Expected NetworkError, got ${error._tag}`)
      }

      expect({ cause: error.cause, route: error.route }).toEqual({
        cause: new Error('offline'),
        route: 'device/code'
      })
    })
  })

  describe('pollForToken', () => {
    const pollForToken = (interval: number) =>
      Effect.flatMap(GitHubAuth, (auth) =>
        auth.pollForToken({ deviceCode: 'device_123', interval })
      )

    it('returns the access token on immediate success', async () => {
      fetchMock.mockResolvedValue(jsonResponse(tokenSuccessBody))

      const result = await provide(pollForToken(0))

      expect(result).toEqual(expectedAccessToken)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        {
          body: JSON.stringify({
            client_id: 'Ov23liTdCH6GSo575kz2',
            device_code: 'device_123',
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          }),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      )
    })

    it('keeps polling at the given interval while authorization is pending', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }))
        .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }))
        .mockResolvedValueOnce(jsonResponse(tokenSuccessBody))

      const result = await provide(pollForToken(0))

      expect(result).toEqual(expectedAccessToken)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('waits five extra seconds when GitHub asks to slow down', async () => {
      vi.useFakeTimers()

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'slow_down' }))
        .mockResolvedValueOnce(jsonResponse(tokenSuccessBody))

      const pending = provide(pollForToken(0))

      // First poll fires immediately, hits slow_down, then waits 0 + 5 seconds.
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(5000)

      const result = await pending

      expect(result).toEqual(expectedAccessToken)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('fails when the device code has expired', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: 'expired_token' }))

      const error = await provide(Effect.flip(pollForToken(0)))

      if (error._tag !== 'DeviceFlowError') {
        throw new Error(`Expected DeviceFlowError, got ${error._tag}`)
      }

      expect({ message: error.message, reason: error.reason }).toEqual({
        message: 'Device code expired. Please try again.',
        reason: 'expired_token'
      })
    })

    it('fails when the user denies access', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: 'access_denied' }))

      const error = await provide(Effect.flip(pollForToken(0)))

      if (error._tag !== 'DeviceFlowError') {
        throw new Error(`Expected DeviceFlowError, got ${error._tag}`)
      }

      expect({ message: error.message, reason: error.reason }).toEqual({
        message: 'Access denied by user.',
        reason: 'access_denied'
      })
    })

    it('fails with the error description for unknown errors', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          error: 'unsupported_grant_type',
          error_description: 'The grant type is not supported.'
        })
      )

      const error = await provide(Effect.flip(pollForToken(0)))

      if (error._tag !== 'DeviceFlowError') {
        throw new Error(`Expected DeviceFlowError, got ${error._tag}`)
      }

      expect({ message: error.message, reason: error.reason }).toEqual({
        message: 'The grant type is not supported.',
        reason: 'unknown'
      })
    })

    it('falls back to the error code when no description is given', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: 'incorrect_client_credentials', error_description: '' })
      )

      const error = await provide(Effect.flip(pollForToken(0)))

      if (error._tag !== 'DeviceFlowError') {
        throw new Error(`Expected DeviceFlowError, got ${error._tag}`)
      }

      expect({ message: error.message, reason: error.reason }).toEqual({
        message: 'incorrect_client_credentials',
        reason: 'unknown'
      })
    })

    it('fails with a NetworkError when the token request rejects', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))

      const error = await provide(Effect.flip(pollForToken(0)))

      if (error._tag !== 'NetworkError') {
        throw new Error(`Expected NetworkError, got ${error._tag}`)
      }

      expect({ cause: error.cause, route: error.route }).toEqual({
        cause: new Error('offline'),
        route: 'oauth/access_token'
      })
    })
  })

  describe('getAuthenticatedUser', () => {
    const getUser = Effect.flatMap(GitHubAuth, (auth) =>
      auth.getAuthenticatedUser('token_123')
    )

    it('returns the authenticated user mapped to camel case', async () => {
      octokitMocks.getAuthenticated.mockResolvedValue({
        data: {
          avatar_url: 'https://example.com/a.png',
          login: 'octocat',
          name: 'The Octocat'
        }
      })

      const result = await provide(getUser)

      expect(result).toEqual({
        avatarUrl: 'https://example.com/a.png',
        login: 'octocat',
        name: 'The Octocat'
      })
    })

    it('maps failures carrying a numeric status to an OctokitError with that status', async () => {
      octokitMocks.getAuthenticated.mockRejectedValue(
        Object.assign(new Error('Bad credentials'), { status: 401 })
      )

      const error = await provide(Effect.flip(getUser))

      expect({
        message: error.message,
        operation: error.operation,
        status: error.status,
        tag: error._tag
      }).toEqual({
        message: 'Bad credentials',
        operation: 'users.getAuthenticated',
        status: 401,
        tag: 'OctokitError'
      })
    })

    it('falls back to status 500 and a generic message for non-Error failures', async () => {
      octokitMocks.getAuthenticated.mockRejectedValue('boom')

      const error = await provide(Effect.flip(getUser))

      expect({
        message: error.message,
        operation: error.operation,
        status: error.status,
        tag: error._tag
      }).toEqual({
        message: 'GitHub request failed',
        operation: 'users.getAuthenticated',
        status: 500,
        tag: 'OctokitError'
      })
    })
  })
})
