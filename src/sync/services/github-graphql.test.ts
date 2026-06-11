import { GraphqlResponseError } from '@octokit/graphql'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GraphQLError,
  HttpError,
  NetworkError,
  PrimaryRateLimitError,
  SecondaryRateLimitError
} from '../errors'
import { classifyGraphQLError } from './github-graphql'

const query = 'query { viewer { login } }'

const makeResponseError = (
  errorMessages: ReadonlyArray<string>,
  headers: Record<string, string> = {}
) => {
  const response = {
    data: null,
    errors: errorMessages.map((message) => ({ message }))
  } as unknown as ConstructorParameters<typeof GraphqlResponseError>[2]

  return new GraphqlResponseError(
    { method: 'POST', url: '/graphql' },
    headers,
    response
  )
}

describe('classifyGraphQLError', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('classifies a rate-limit response error as a primary rate limit using the reset header', () => {
    const error = makeResponseError(['API rate limit exceeded for user.'], {
      'x-ratelimit-reset': '1750000000'
    })

    const result = classifyGraphQLError(error, query)

    expect(result).toEqual(
      new PrimaryRateLimitError({ kind: 'graphql', resetAt: 1750000000 })
    )
  })

  it('falls back to one minute from now when the reset header is missing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T12:00:00Z'))

    const error = makeResponseError(['You have hit a rate limit.'])
    const result = classifyGraphQLError(error, query)

    expect(result).toEqual(
      new PrimaryRateLimitError({
        kind: 'graphql',
        resetAt: Math.floor(Date.now() / 1000) + 60
      })
    )
  })

  it('classifies a response with GraphQL errors as a GraphQLError', () => {
    const error = makeResponseError(['Field "nope" does not exist.'])

    const result = classifyGraphQLError(error, query)

    expect(result).toEqual(
      new GraphQLError({
        query,
        errors: [{ message: 'Field "nope" does not exist.' }]
      })
    )
  })

  it('classifies a response error without GraphQL errors as an HttpError with status 0', () => {
    const error = makeResponseError([])

    const result = classifyGraphQLError(error, query)

    expect(result).toEqual(
      new HttpError({
        route: 'graphql',
        status: 0,
        message: 'Request failed due to following response errors:\n'
      })
    )
  })

  it('classifies a 429 as a secondary rate limit using the retry-after header', () => {
    const error = {
      response: { headers: { 'retry-after': '5' } },
      status: 429
    }

    const result = classifyGraphQLError(error, query)

    expect(result).toEqual(
      new SecondaryRateLimitError({ kind: 'graphql', retryAfterMs: 5000 })
    )
  })

  it('falls back to 30 seconds when a 429 has no retry-after header', () => {
    const result = classifyGraphQLError({ status: 429 }, query)

    expect(result).toEqual(
      new SecondaryRateLimitError({ kind: 'graphql', retryAfterMs: 30_000 })
    )
  })

  it('classifies other statuses as an HttpError with the original message', () => {
    const error = { message: 'Server exploded', status: 500 }

    const result = classifyGraphQLError(error, query)

    expect(result).toEqual(
      new HttpError({
        route: 'graphql',
        status: 500,
        message: 'Server exploded'
      })
    )
  })

  it('falls back to a generic message when an HTTP error has none', () => {
    const result = classifyGraphQLError({ status: 502 }, query)

    expect(result).toEqual(
      new HttpError({ route: 'graphql', status: 502, message: 'HTTP error' })
    )
  })

  it('classifies errors without a status as a NetworkError', () => {
    const cause = new Error('socket hang up')

    const result = classifyGraphQLError(cause, query)

    expect(result).toEqual(new NetworkError({ route: 'graphql', cause }))
  })
})
