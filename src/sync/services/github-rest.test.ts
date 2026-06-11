import { RequestError } from '@octokit/request-error'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ForbiddenError,
  HttpError,
  NetworkError,
  NotFoundError,
  PermissionError,
  PrimaryRateLimitError,
  SecondaryRateLimitError
} from '../errors'
import { classifyRestError } from './github-rest'

const route = 'GET /repos/{owner}/{repo}/pulls'

const makeRequestError = (
  message: string,
  status: number,
  headers: Record<string, string> = {}
) =>
  new RequestError(message, status, {
    request: {
      headers: {},
      method: 'GET',
      url: 'https://api.github.com/test'
    },
    response: {
      data: {},
      headers,
      status,
      url: 'https://api.github.com/test'
    }
  })

describe('classifyRestError', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('classifies a 403 secondary rate limit using the retry-after header', () => {
    const error = makeRequestError(
      'You have exceeded a secondary rate limit.',
      403,
      { 'retry-after': '5' }
    )

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new SecondaryRateLimitError({ kind: 'rest', retryAfterMs: 5000 })
    )
  })

  it('falls back to 30 seconds when a secondary rate limit has no retry-after header', () => {
    const error = makeRequestError(
      'You have exceeded a secondary rate limit.',
      403
    )

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new SecondaryRateLimitError({ kind: 'rest', retryAfterMs: 30_000 })
    )
  })

  it('classifies a 403 rate-limit message as a primary rate limit using the reset header', () => {
    const error = makeRequestError('API rate limit exceeded for user.', 403, {
      'x-ratelimit-reset': '1750000000'
    })

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new PrimaryRateLimitError({ kind: 'rest', resetAt: 1750000000 })
    )
  })

  it('classifies a 403 with zero remaining requests as a primary rate limit', () => {
    const error = makeRequestError('Forbidden', 403, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1750000000'
    })

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new PrimaryRateLimitError({ kind: 'rest', resetAt: 1750000000 })
    )
  })

  it('falls back to one minute from now when the reset header is missing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T12:00:00Z'))

    const error = makeRequestError('API rate limit exceeded for user.', 403)
    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new PrimaryRateLimitError({
        kind: 'rest',
        resetAt: Math.floor(Date.now() / 1000) + 60
      })
    )
  })

  it('classifies a 429 as a secondary rate limit', () => {
    const error = makeRequestError('Too many requests', 429, {
      'retry-after': '10'
    })

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new SecondaryRateLimitError({ kind: 'rest', retryAfterMs: 10_000 })
    )
  })

  it('classifies a 404 as a NotFoundError', () => {
    const error = makeRequestError('Not Found', 404)

    const result = classifyRestError(error, route)

    expect(result).toEqual(new NotFoundError({ route, resourceId: null }))
  })

  it('prefers NotFoundError over PermissionError for a 404 with a permission message', () => {
    const error = makeRequestError(
      'Resource not accessible by integration',
      404
    )

    const result = classifyRestError(error, route)

    expect(result).toEqual(new NotFoundError({ route, resourceId: null }))
  })

  it('classifies a resource-not-accessible message as a PermissionError', () => {
    const error = makeRequestError(
      'Resource not accessible by integration',
      403
    )

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new PermissionError({
        route,
        message: 'Resource not accessible by integration'
      })
    )
  })

  it('classifies other 403s as a ForbiddenError', () => {
    const error = makeRequestError('Must have admin rights', 403)

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new ForbiddenError({ route, message: 'Must have admin rights' })
    )
  })

  it('classifies other statuses as an HttpError', () => {
    const error = makeRequestError('Server Error', 500)

    const result = classifyRestError(error, route)

    expect(result).toEqual(
      new HttpError({ route, status: 500, message: 'Server Error' })
    )
  })

  it('classifies non-RequestError values as a NetworkError', () => {
    const cause = new Error('socket hang up')

    const result = classifyRestError(cause, route)

    expect(result).toEqual(new NetworkError({ route, cause }))
  })
})
