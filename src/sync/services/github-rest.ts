import { Octokit } from '@octokit/rest'
import { RequestError } from '@octokit/request-error'
import { Context, Effect, Layer, Option, ParseResult, Schema } from 'effect'

import {
  ForbiddenError,
  HttpError,
  NetworkError,
  NotFoundError,
  PermissionError,
  PrimaryRateLimitError,
  SchemaDecodeError,
  SecondaryRateLimitError,
  type GitHubTransportError
} from '../errors'
import { retryTransport } from '../retry'
import type { ETagKey } from '../schemas/domain'
import { EtagStore } from './etag-store'
import { RateLimitTracker } from './rate-limit-tracker'
import { RequestBroker } from './request-broker'
import { TokenProvider } from './token-provider'

const cachedClients = new Map<string, Octokit>()

function getClient(token: string): Octokit {
  const cached = cachedClients.get(token)

  if (cached) {
    return cached
  }

  const client = new Octokit({ auth: token })
  cachedClients.set(token, client)

  return client
}

function classifyRestError(
  error: unknown,
  route: string
): GitHubTransportError {
  if (error instanceof RequestError) {
    const headers = (error.response?.headers ?? {}) as Record<string, string>
    const messageLower = error.message?.toLowerCase() ?? ''

    if (
      error.status === 403 &&
      (messageLower.includes('rate limit') ||
        headers['x-ratelimit-remaining'] === '0')
    ) {
      const resetAt = headers['x-ratelimit-reset']
      const resetSeconds = resetAt
        ? parseInt(resetAt, 10)
        : Math.floor(Date.now() / 1000) + 60

      return new PrimaryRateLimitError({
        kind: 'rest',
        resetAt: resetSeconds
      })
    }

    if (error.status === 429) {
      const retryAfter = headers['retry-after']

      return new SecondaryRateLimitError({
        kind: 'rest',
        retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : 30_000
      })
    }

    if (error.status === 404) {
      return new NotFoundError({ route, resourceId: null })
    }

    if (
      messageLower.includes('resource not accessible by integration') ||
      messageLower.includes('resource not accessible')
    ) {
      return new PermissionError({ route, message: error.message })
    }

    if (error.status === 403) {
      return new ForbiddenError({ route, message: error.message })
    }

    return new HttpError({
      route,
      status: error.status,
      message: error.message
    })
  }

  return new NetworkError({ route, cause: error })
}

export interface RestRequestOptions {
  etagKey?: ETagKey
}

export class GitHubRest extends Context.Tag('sync/GitHubRest')<
  GitHubRest,
  {
    readonly request: <A, I>(
      route: string,
      params: Record<string, unknown>,
      schema: Schema.Schema<A, I>,
      options?: RestRequestOptions
    ) => Effect.Effect<Option.Option<A>, GitHubTransportError>
  }
>() {}

export const GitHubRestLive: Layer.Layer<
  GitHubRest,
  never,
  TokenProvider | RateLimitTracker | RequestBroker | EtagStore
> = Layer.effect(
  GitHubRest,
  Effect.gen(function* () {
    const tokenProvider = yield* TokenProvider
    const tracker = yield* RateLimitTracker
    const broker = yield* RequestBroker
    const etagStore = yield* EtagStore

    return {
      request: <A, I>(
        route: string,
        params: Record<string, unknown>,
        schema: Schema.Schema<A, I>,
        options?: RestRequestOptions
      ) => {
        const decodeBody = Schema.decodeUnknown(schema)

        const performRequest: Effect.Effect<
          Option.Option<A>,
          GitHubTransportError
        > = Effect.gen(function* () {
          const token = yield* tokenProvider.getToken

          yield* Effect.if(tracker.shouldPause('rest'), {
            onTrue: () => tracker.waitUntilReset('rest'),
            onFalse: () => Effect.void
          })

          const cachedEtag = options?.etagKey
            ? yield* etagStore.get(options.etagKey).pipe(
                Effect.catchAll(() =>
                  Effect.succeed(
                    Option.none<{
                      etag: string
                      lastModified: string | null
                      validatedAt: string
                    }>()
                  )
                )
              )
            : Option.none<{
                etag: string
                lastModified: string | null
                validatedAt: string
              }>()

          const headers: Record<string, string> = {}

          if (Option.isSome(cachedEtag)) {
            headers['If-None-Match'] = cachedEtag.value.etag

            if (cachedEtag.value.lastModified) {
              headers['If-Modified-Since'] = cachedEtag.value.lastModified
            }
          }

          const client = getClient(token)

          const response = yield* Effect.tryPromise({
            try: () => client.request(route, { ...params, headers }),
            catch: (cause) => {
              if (cause instanceof RequestError && cause.status === 304) {
                return null as unknown as GitHubTransportError
              }

              return classifyRestError(cause, route)
            }
          }).pipe(
            Effect.catchAll((error) => {
              if (error === null) {
                return Effect.succeed(null)
              }

              return Effect.fail(error)
            })
          )

          yield* broker.recordCost('rest', 1)

          if (response === null) {
            return Option.none<A>()
          }

          const responseHeaders = response.headers as Record<string, string>

          yield* tracker.updateFromHeaders('rest', responseHeaders)

          const decoded = yield* Effect.mapError(
            decodeBody(response.data),
            (issue: ParseResult.ParseError) =>
              new SchemaDecodeError({ route, issue: issue.issue })
          )

          // Persist ETag only after a successful decode — otherwise a failure
          // here can cause the next run to get a 304 for data we never stored.
          const etagHeader = responseHeaders['etag']
          const lastModifiedHeader = responseHeaders['last-modified']

          if (options?.etagKey && etagHeader) {
            yield* Effect.ignore(
              etagStore.set(
                options.etagKey,
                etagHeader,
                lastModifiedHeader ?? undefined
              )
            )
          }

          return Option.some(decoded)
        })

        return retryTransport(broker.withSlot('rest', performRequest))
      }
    }
  })
)
