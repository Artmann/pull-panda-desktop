import { graphql, GraphqlResponseError } from '@octokit/graphql'
import { Context, Effect, Layer, ParseResult, Schema } from 'effect'

import {
  GraphQLError,
  HttpError,
  NetworkError,
  PrimaryRateLimitError,
  SchemaDecodeError,
  SecondaryRateLimitError,
  type GitHubTransportError
} from '../errors'
import { retryTransport } from '../retry'
import { RateLimitSchema } from '../schemas/github-graphql'
import { RateLimitTracker } from './rate-limit-tracker'
import { RequestBroker } from './request-broker'
import { TokenProvider } from './token-provider'

type GraphQLApi = typeof graphql

const cachedClients = new Map<string, GraphQLApi>()

function getClient(token: string): GraphQLApi {
  const cached = cachedClients.get(token)

  if (cached) {
    return cached
  }

  const client = graphql.defaults({
    headers: { authorization: `token ${token}` }
  })

  cachedClients.set(token, client)

  return client
}

function classifyGraphQLError(
  error: unknown,
  query: string
): GitHubTransportError {
  if (error instanceof GraphqlResponseError) {
    const headers = error.headers ?? {}
    const messageLower = error.message?.toLowerCase() ?? ''
    const isRateLimit =
      messageLower.includes('api rate limit exceeded') ||
      messageLower.includes('rate limit')

    if (isRateLimit) {
      const resetAt = headers['x-ratelimit-reset']
      const resetSeconds = resetAt
        ? parseInt(resetAt, 10)
        : Math.floor(Date.now() / 1000) + 60

      return new PrimaryRateLimitError({
        kind: 'graphql',
        resetAt: resetSeconds
      })
    }

    if (error.errors && error.errors.length > 0) {
      return new GraphQLError({
        query,
        errors: error.errors.map((entry) => ({ message: entry.message }))
      })
    }

    return new HttpError({
      route: 'graphql',
      status: 0,
      message: error.message ?? 'GraphQL error'
    })
  }

  const status = (error as { status?: number } | null)?.status

  if (status === 429) {
    const headers =
      (error as { response?: { headers?: Record<string, string> } } | null)
        ?.response?.headers ?? {}
    const retryAfter = headers['retry-after']

    return new SecondaryRateLimitError({
      kind: 'graphql',
      retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : 30_000
    })
  }

  if (typeof status === 'number') {
    return new HttpError({
      route: 'graphql',
      status,
      message: (error as { message?: string } | null)?.message ?? 'HTTP error'
    })
  }

  return new NetworkError({ route: 'graphql', cause: error })
}

export class GitHubGraphQL extends Context.Tag('sync/GitHubGraphQL')<
  GitHubGraphQL,
  {
    readonly query: <A, I>(
      query: string,
      variables: Record<string, unknown>,
      schema: Schema.Schema<A, I>
    ) => Effect.Effect<A, GitHubTransportError>
  }
>() {}

interface ResponseWithRateLimit {
  rateLimit?: {
    limit: number
    remaining: number
    resetAt: string
    cost?: number
  }
}

export const GitHubGraphQLLive: Layer.Layer<
  GitHubGraphQL,
  never,
  TokenProvider | RateLimitTracker | RequestBroker
> = Layer.effect(
  GitHubGraphQL,
  Effect.gen(function* () {
    const tokenProvider = yield* TokenProvider
    const tracker = yield* RateLimitTracker
    const broker = yield* RequestBroker
    const decodeRateLimit = Schema.decodeUnknown(RateLimitSchema)

    return {
      query: <A, I>(
        queryText: string,
        variables: Record<string, unknown>,
        schema: Schema.Schema<A, I>
      ) => {
        const decodeBody = Schema.decodeUnknown(schema)

        const performRequest = Effect.gen(function* () {
          const token = yield* tokenProvider.getToken

          yield* Effect.if(tracker.shouldPause('graphql'), {
            onTrue: () => tracker.waitUntilReset('graphql'),
            onFalse: () => Effect.void
          })

          const client = getClient(token)

          const raw = yield* Effect.tryPromise({
            try: () => client<ResponseWithRateLimit>(queryText, variables),
            catch: (cause) => classifyGraphQLError(cause, queryText)
          })

          if (raw.rateLimit) {
            const rateLimit = yield* Effect.mapError(
              decodeRateLimit(raw.rateLimit),
              (issue: ParseResult.ParseError) =>
                new SchemaDecodeError({
                  route: 'graphql:rateLimit',
                  issue: issue.issue
                })
            )

            yield* tracker.updateFromGraphQLRateLimit(rateLimit)
            yield* broker.recordCost('graphql', rateLimit.cost ?? 1)
          } else {
            yield* broker.recordCost('graphql', 1)
          }

          return yield* Effect.mapError(
            decodeBody(raw),
            (issue: ParseResult.ParseError) =>
              new SchemaDecodeError({
                route: 'graphql',
                issue: issue.issue
              })
          )
        })

        return retryTransport(broker.withSlot('graphql', performRequest))
      }
    }
  })
)
