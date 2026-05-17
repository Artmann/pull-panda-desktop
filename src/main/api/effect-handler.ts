import { Cause, Effect, Exit, Option } from 'effect'
import type { Context as HonoContext } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { AppLayer } from '../../sync/layer'
import { getAppRuntime } from '../../sync/runtime'
import { errorToHttp, ValidationError, type RouteError } from './errors'
import type { Layer } from 'effect'

export type AppServices = Layer.Layer.Success<AppLayer>

export type AppEnv = {
  Variables: {
    token: string
  }
}

export const effectHandler =
  <A, E extends RouteError>(
    make: (context: HonoContext<AppEnv>) => Effect.Effect<A, E, AppServices>
  ) =>
  async (context: HonoContext<AppEnv>) => {
    const runtime = getAppRuntime()
    const exit = await runtime.runPromiseExit(make(context))

    return Exit.match(exit, {
      onSuccess: (value) => {
        if (value === null || value === undefined) {
          return context.body(null, 204)
        }

        return context.json(value as never)
      },
      onFailure: (cause) => {
        const failure = Cause.failureOption(cause)

        if (Option.isSome(failure)) {
          const { body, status } = errorToHttp(failure.value)

          return context.json(body, status as ContentfulStatusCode)
        }

        console.error('Unhandled cause in effectHandler:', Cause.pretty(cause))

        return context.json(
          { error: { message: 'Internal error' } },
          500 as ContentfulStatusCode
        )
      }
    })
  }

export const parseJson = <Parsed>(
  context: HonoContext<AppEnv>,
  validate: (raw: unknown) => Parsed
): Effect.Effect<Parsed, ValidationError> =>
  Effect.tryPromise({
    try: async () => {
      const raw = await context.req.json()

      return validate(raw)
    },
    catch: (cause) =>
      new ValidationError({
        message: cause instanceof Error ? cause.message : 'Invalid JSON body'
      })
  })

export const requireString = (
  value: unknown,
  field: string
): Effect.Effect<string, ValidationError> => {
  if (typeof value !== 'string' || value.length === 0) {
    return Effect.fail(new ValidationError({ field, message: 'is required' }))
  }

  return Effect.succeed(value)
}

export const requireNumber = (
  value: unknown,
  field: string
): Effect.Effect<number, ValidationError> => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return Effect.fail(
      new ValidationError({ field, message: 'must be a number' })
    )
  }

  return Effect.succeed(value)
}
