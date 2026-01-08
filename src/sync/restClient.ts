import { Octokit } from '@octokit/rest'
import { RequestError } from '@octokit/request-error'

import {
  rateLimitManager,
  isRateLimitError,
  getRetryAfterMs,
  sleep
} from './rateLimitManager'

export interface ConditionalRequestOptions {
  etag?: string
  lastModified?: string
}

export interface ConditionalRequestResult<T> {
  data: T | null
  notModified: boolean
  etag: string | null
  lastModified: string | null
}

export interface RestClient {
  octokit: Octokit

  request<T>(
    route: string,
    params?: Record<string, unknown>,
    options?: ConditionalRequestOptions
  ): Promise<ConditionalRequestResult<T>>
}

export function createRestClient(token: string): RestClient {
  const octokit = new Octokit({ auth: token })

  async function request<T>(
    route: string,
    params?: Record<string, unknown>,
    options?: ConditionalRequestOptions
  ): Promise<ConditionalRequestResult<T>> {
    // Check if we should pause before making the request
    if (rateLimitManager.shouldPause('rest')) {
      const waitMs = rateLimitManager.getWaitTimeMs('rest')
      console.log(`[REST] Rate limit low, waiting ${Math.round(waitMs / 1000)}s until reset`)
      await sleep(waitMs)
    }

    const headers: Record<string, string> = {}

    if (options?.etag) {
      headers['If-None-Match'] = options.etag
    }

    if (options?.lastModified) {
      headers['If-Modified-Since'] = options.lastModified
    }

    try {
      const response = await octokit.request(route, {
        ...params,
        headers
      })

      // Update rate limit state from response headers
      rateLimitManager.updateFromHeaders('rest', response.headers as Record<string, string>)

      return {
        data: response.data as T,
        notModified: false,
        etag: (response.headers.etag as string) ?? null,
        lastModified: (response.headers['last-modified'] as string) ?? null
      }
    } catch (error) {
      // Handle 304 Not Modified - this is not an error, just no changes
      if (error instanceof RequestError && error.status === 304) {
        return {
          data: null,
          notModified: true,
          etag: options?.etag ?? null,
          lastModified: options?.lastModified ?? null
        }
      }

      // Handle rate limit errors with retry
      if (isRateLimitError(error)) {
        const err = error as { response?: { headers?: Record<string, string> } }
        const headers = err.response?.headers ?? {}
        const waitMs = getRetryAfterMs(headers) ?? 60000

        console.log(`[REST] Rate limited, waiting ${Math.round(waitMs / 1000)}s before retry`)

        rateLimitManager.updateFromHeaders('rest', headers)
        await sleep(waitMs)

        // Retry the request
        return request<T>(route, params, options)
      }

      throw error
    }
  }

  return {
    octokit,
    request
  }
}
