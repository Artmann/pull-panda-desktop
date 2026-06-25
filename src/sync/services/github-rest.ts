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
import type { ETagEntry, ETagKey } from '../schemas/domain'
import { EtagStore } from './etag-store'
import { parseResetSeconds, parseRetryAfterMs } from './rate-limit-headers'
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

function isPermissionMessage(messageLower: string): boolean {
  return (
    messageLower.includes('resource not accessible by integration') ||
    messageLower.includes('resource not accessible')
  )
}

function primaryRateLimitError(
  headers: Record<string, string>
): PrimaryRateLimitError {
  return new PrimaryRateLimitError({
    kind: 'rest',
    resetAt: parseResetSeconds(headers['x-ratelimit-reset'])
  })
}

function secondaryRateLimitError(
  headers: Record<string, string>
): SecondaryRateLimitError {
  return new SecondaryRateLimitError({
    kind: 'rest',
    retryAfterMs: parseRetryAfterMs(headers['retry-after'])
  })
}

function classifyRateLimitError(
  status: number,
  messageLower: string,
  headers: Record<string, string>
): GitHubTransportError | null {
  // Order matters: 'rate limit' is a substring of 'secondary rate limit',
  // so the secondary-specific branch must be checked first. Otherwise a
  // secondary-rate-limit 403 carrying a retry-after header would be
  // misclassified as primary and the retry would wait until the primary
  // window resets (potentially hours) instead of the secondary's retry-after.
  if (status === 403 && messageLower.includes('secondary rate limit')) {
    return secondaryRateLimitError(headers)
  }

  if (
    status === 403 &&
    (messageLower.includes('rate limit') ||
      headers['x-ratelimit-remaining'] === '0')
  ) {
    return primaryRateLimitError(headers)
  }

  if (status === 429) {
    return secondaryRateLimitError(headers)
  }

  return null
}

function classifyRequestError(
  error: RequestError,
  route: string
): GitHubTransportError {
  const headers = (error.response?.headers ?? {}) as Record<string, string>
  const messageLower = error.message?.toLowerCase() ?? ''
  const rateLimitError = classifyRateLimitError(
    error.status,
    messageLower,
    headers
  )

  if (rateLimitError) {
    return rateLimitError
  }

  if (error.status === 404) {
    return new NotFoundError({ route, resourceId: null })
  }

  if (isPermissionMessage(messageLower)) {
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

export function classifyRestError(
  error: unknown,
  route: string
): GitHubTransportError {
  if (error instanceof RequestError) {
    return classifyRequestError(error, route)
  }

  return new NetworkError({ route, cause: error })
}

interface RestRequestOptions {
  etagKey?: ETagKey
}

type EtagStoreService = Context.Tag.Service<EtagStore>

// Builds the conditional-request headers for a cached ETag entry. Returns an
// empty record when nothing is cached so the request goes out unconditionally.
function buildConditionalHeaders(
  cachedEtag: Option.Option<ETagEntry>
): Record<string, string> {
  if (Option.isNone(cachedEtag)) {
    return {}
  }

  const headers: Record<string, string> = {
    'If-None-Match': cachedEtag.value.etag
  }

  if (cachedEtag.value.lastModified) {
    headers['If-Modified-Since'] = cachedEtag.value.lastModified
  }

  return headers
}

function loadCachedEtag(
  etagStore: EtagStoreService,
  etagKey: ETagKey | undefined
): Effect.Effect<Option.Option<ETagEntry>> {
  if (!etagKey) {
    return Effect.succeed(Option.none<ETagEntry>())
  }

  return etagStore
    .get(etagKey)
    .pipe(Effect.catchAll(() => Effect.succeed(Option.none<ETagEntry>())))
}

function persistEtag(
  etagStore: EtagStoreService,
  etagKey: ETagKey | undefined,
  responseHeaders: Record<string, string>
): Effect.Effect<void> {
  const etagHeader = responseHeaders['etag']

  if (!etagKey || !etagHeader) {
    return Effect.void
  }

  return Effect.ignore(
    etagStore.set(etagKey, etagHeader, responseHeaders['last-modified'])
  )
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

          const cachedEtag = yield* loadCachedEtag(etagStore, options?.etagKey)
          const headers = buildConditionalHeaders(cachedEtag)

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
          yield* persistEtag(etagStore, options?.etagKey, responseHeaders)

          return Option.some(decoded)
        })

        return retryTransport(broker.withSlot('rest', performRequest)).pipe(
          Effect.withSpan(`github.rest ${route}`, {
            kind: 'client',
            attributes: { 'github.api': 'rest', 'http.route': route }
          })
        )
      }
    }
  })
)
