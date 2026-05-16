import { Context, Effect, Layer } from 'effect'

import { MissingTokenError } from '../errors'

export class TokenProvider extends Context.Tag('sync/TokenProvider')<
  TokenProvider,
  {
    readonly getToken: Effect.Effect<string, MissingTokenError>
  }
>() {}

export const makeTokenProviderLayer = (
  getToken: () => string | null
): Layer.Layer<TokenProvider> =>
  Layer.succeed(TokenProvider, {
    getToken: Effect.suspend(() => {
      const token = getToken()

      if (!token) {
        return Effect.fail(
          new MissingTokenError({
            message: 'No GitHub token available'
          })
        )
      }

      return Effect.succeed(token)
    })
  })
