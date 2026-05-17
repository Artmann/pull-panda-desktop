import { Effect } from 'effect'

import { AuthStore } from '../../services/auth-store'
import { GitHubAuth } from '../../services/github-auth'

export const requestDeviceCodeOperation = Effect.gen(function* () {
  const auth = yield* GitHubAuth

  const code = yield* auth.requestDeviceCode

  return {
    device_code: code.deviceCode,
    expires_in: code.expiresIn,
    interval: code.interval,
    user_code: code.userCode,
    verification_uri: code.verificationUri
  }
})

export const pollForTokenOperation = (input: {
  readonly deviceCode: string
  readonly interval: number
}) =>
  Effect.gen(function* () {
    const auth = yield* GitHubAuth
    const store = yield* AuthStore

    const token = yield* auth.pollForToken(input)

    yield* store.save(token.accessToken)

    return { success: true } as const
  })

export const loadStoredToken = Effect.gen(function* () {
  const store = yield* AuthStore

  return yield* store.load
})

export const clearStoredToken = Effect.gen(function* () {
  const store = yield* AuthStore

  yield* store.clear

  return { success: true } as const
})

export const getCurrentUser = Effect.gen(function* () {
  const store = yield* AuthStore
  const auth = yield* GitHubAuth

  const token = yield* store.load

  if (!token) {
    return null
  }

  const user = yield* Effect.either(auth.getAuthenticatedUser(token))

  if (user._tag === 'Left') {
    return null
  }

  return {
    avatar_url: user.right.avatarUrl,
    login: user.right.login,
    name: user.right.name
  }
})
