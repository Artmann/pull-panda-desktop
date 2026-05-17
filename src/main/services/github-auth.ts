import { Octokit } from '@octokit/rest'
import { Context, Effect, Layer } from 'effect'

import { DeviceFlowError, OctokitError } from '../api/errors'
import { NetworkError } from '../../sync/errors'

const gitHubClientId = 'Ov23liTdCH6GSo575kz2'
const gitHubScopes = 'repo read:user'

export interface DeviceCode {
  readonly deviceCode: string
  readonly expiresIn: number
  readonly interval: number
  readonly userCode: string
  readonly verificationUri: string
}

export interface AccessToken {
  readonly accessToken: string
  readonly scope: string
  readonly tokenType: string
}

export interface GitHubUser {
  readonly avatarUrl: string
  readonly login: string
  readonly name: string | null
}

interface DeviceCodeResponse {
  device_code: string
  expires_in: number
  interval: number
  user_code: string
  verification_uri: string
}

interface TokenSuccess {
  access_token: string
  scope: string
  token_type: string
}

interface TokenError {
  error: string
  error_description: string
  error_uri?: string
}

type TokenResponse = TokenError | TokenSuccess

export class GitHubAuth extends Context.Tag('main/GitHubAuth')<
  GitHubAuth,
  {
    readonly getAuthenticatedUser: (
      token: string
    ) => Effect.Effect<GitHubUser, OctokitError>
    readonly pollForToken: (input: {
      readonly deviceCode: string
      readonly interval: number
    }) => Effect.Effect<AccessToken, DeviceFlowError | NetworkError>
    readonly requestDeviceCode: Effect.Effect<
      DeviceCode,
      DeviceFlowError | NetworkError
    >
  }
>() {}

const sleep = (ms: number) =>
  Effect.async<void>((resume) => {
    const timer = setTimeout(() => resume(Effect.void), ms)

    return Effect.sync(() => clearTimeout(timer))
  })

export const GitHubAuthLive: Layer.Layer<GitHubAuth> = Layer.succeed(
  GitHubAuth,
  {
    requestDeviceCode: Effect.tryPromise({
      try: async () => {
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
          throw new Error(
            `Failed to request device code: ${response.statusText}`
          )
        }

        return (await response.json()) as DeviceCodeResponse
      },
      catch: (cause) => new NetworkError({ route: 'device/code', cause })
    }).pipe(
      Effect.map((data) => ({
        deviceCode: data.device_code,
        expiresIn: data.expires_in,
        interval: data.interval,
        userCode: data.user_code,
        verificationUri: data.verification_uri
      }))
    ),

    pollForToken: ({ deviceCode, interval }) => {
      const poll = (
        delaySeconds: number
      ): Effect.Effect<AccessToken, DeviceFlowError | NetworkError> =>
        Effect.gen(function* () {
          yield* sleep(delaySeconds * 1000)

          const data = yield* Effect.tryPromise({
            try: async () => {
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

              return (await response.json()) as TokenResponse
            },
            catch: (cause) =>
              new NetworkError({ route: 'oauth/access_token', cause })
          })

          if ('error' in data) {
            if (data.error === 'authorization_pending') {
              return yield* poll(interval)
            }

            if (data.error === 'slow_down') {
              return yield* poll(interval + 5)
            }

            if (data.error === 'expired_token') {
              return yield* Effect.fail(
                new DeviceFlowError({
                  reason: 'expired_token',
                  message: 'Device code expired. Please try again.'
                })
              )
            }

            if (data.error === 'access_denied') {
              return yield* Effect.fail(
                new DeviceFlowError({
                  reason: 'access_denied',
                  message: 'Access denied by user.'
                })
              )
            }

            return yield* Effect.fail(
              new DeviceFlowError({
                reason: 'unknown',
                message: data.error_description || data.error
              })
            )
          }

          return {
            accessToken: data.access_token,
            scope: data.scope,
            tokenType: data.token_type
          }
        })

      return poll(0)
    },

    getAuthenticatedUser: (token) =>
      Effect.tryPromise({
        try: async () => {
          const octokit = new Octokit({ auth: token })
          const { data } = await octokit.users.getAuthenticated()

          return {
            avatarUrl: data.avatar_url,
            login: data.login,
            name: data.name
          }
        },
        catch: (cause) => {
          const status =
            typeof cause === 'object' &&
            cause !== null &&
            'status' in cause &&
            typeof (cause as { status: unknown }).status === 'number'
              ? (cause as { status: number }).status
              : 500
          const message =
            cause instanceof Error ? cause.message : 'GitHub request failed'

          return new OctokitError({
            operation: 'users.getAuthenticated',
            status,
            message
          })
        }
      })
  }
)
