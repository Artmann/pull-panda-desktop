import { Octokit } from '@octokit/rest'
import { RequestError } from '@octokit/request-error'
import { log } from 'tiny-typescript-logger'

import {
  rateLimitManager,
  isRateLimitError,
  getRetryAfterMs,
  sleep
} from './rate-limit-manager'
import {
  checkPrimaryRateLimit,
  computeBackoffMs,
  maxRetries,
  requestBroker
} from './request-broker'

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

export class RestClient {
  octokit: Octokit

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token })
  }

  async request<T>(
    route: string,
    params?: Record<string, unknown>,
    options?: ConditionalRequestOptions
  ): Promise<ConditionalRequestResult<T>> {
    return this.runWithRetry(route, params, options, 0)
  }

  private async runWithRetry<T>(
    route: string,
    params: Record<string, unknown> | undefined,
    options: ConditionalRequestOptions | undefined,
    attempt: number
  ): Promise<ConditionalRequestResult<T>> {
    await checkPrimaryRateLimit('rest')

    const release = await requestBroker.acquire('rest')

    const headers: Record<string, string> = {}

    if (options?.etag) {
      headers['If-None-Match'] = options.etag
    }

    if (options?.lastModified) {
      headers['If-Modified-Since'] = options.lastModified
    }

    try {
      const response = await this.octokit.request(route, {
        ...params,
        headers
      })

      rateLimitManager.updateFromHeaders(
        'rest',
        response.headers as Record<string, string>
      )
      requestBroker.recordCost('rest', 1)

      return {
        data: response.data as T,
        notModified: false,
        etag: (response.headers.etag as string) ?? null,
        lastModified: (response.headers['last-modified'] as string) ?? null
      }
    } catch (error) {
      if (error instanceof RequestError && error.status === 304) {
        // 304s do not consume primary quota but they do consume a request slot.
        requestBroker.recordCost('rest', 1)

        return {
          data: null,
          notModified: true,
          etag: options?.etag ?? null,
          lastModified: options?.lastModified ?? null
        }
      }

      if (isRateLimitError(error)) {
        const err = error as { response?: { headers?: Record<string, string> } }
        const responseHeaders = err.response?.headers ?? {}
        const retryAfterMs = getRetryAfterMs(responseHeaders)

        rateLimitManager.updateFromHeaders('rest', responseHeaders)

        if (attempt >= maxRetries) {
          log.error(
            `[REST] Rate limited after ${maxRetries} retries; giving up`
          )

          throw error
        }

        const waitMs = computeBackoffMs(attempt, retryAfterMs)

        log.info(
          `[REST] Rate limited, sleeping ${Math.round(
            waitMs / 1000
          )}s (attempt ${attempt + 1}/${maxRetries})`
        )

        // Release the slot before sleeping so other lanes can drain.
        release()
        await sleep(waitMs)

        return this.runWithRetry<T>(route, params, options, attempt + 1)
      }

      throw error
    } finally {
      release()
    }
  }
}

export function createRestClient(token: string): RestClient {
  return new RestClient(token)
}
