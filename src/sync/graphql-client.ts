import { graphql, GraphqlResponseError } from '@octokit/graphql'
import { log } from 'tiny-typescript-logger'

import { rateLimitManager, isRateLimitError, sleep } from './rate-limit-manager'
import {
  checkPrimaryRateLimit,
  computeBackoffMs,
  maxRetries,
  requestBroker
} from './request-broker'

export interface GraphQLRateLimit {
  limit: number
  remaining: number
  resetAt: string
  cost?: number
}

export class GraphQLClient {
  private client: typeof graphql

  constructor(token: string) {
    this.client = graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    })
  }

  async query<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    return this.runWithRetry<T>(query, variables, 0)
  }

  private async runWithRetry<T>(
    query: string,
    variables: Record<string, unknown> | undefined,
    attempt: number
  ): Promise<T> {
    await checkPrimaryRateLimit('graphql')

    const release = await requestBroker.acquire('graphql')

    try {
      const response = await this.client<T & { rateLimit?: GraphQLRateLimit }>(
        query,
        variables
      )

      if (response.rateLimit) {
        rateLimitManager.updateFromGraphQL(response.rateLimit)
        // GraphQL cost field is the points the request consumed.
        const cost = response.rateLimit.cost ?? 1
        requestBroker.recordCost('graphql', cost)
      } else {
        requestBroker.recordCost('graphql', 1)
      }

      return response
    } catch (error) {
      if (isRateLimitError(error)) {
        const graphqlError = error as GraphqlResponseError<unknown>
        const headers = graphqlError.headers ?? {}
        const resetAt = headers['x-ratelimit-reset']
        const retryAfterMs = resetAt
          ? Math.max(
              0,
              (parseInt(resetAt, 10) - Math.floor(Date.now() / 1000) + 5) * 1000
            )
          : null

        if (attempt >= maxRetries) {
          log.error(
            `[GraphQL] Rate limited after ${maxRetries} retries; giving up`
          )

          throw error
        }

        const waitMs = computeBackoffMs(attempt, retryAfterMs)

        log.info(
          `[GraphQL] Rate limited, sleeping ${Math.round(
            waitMs / 1000
          )}s (attempt ${attempt + 1}/${maxRetries})`
        )

        release()
        await sleep(waitMs)

        return this.runWithRetry<T>(query, variables, attempt + 1)
      }

      throw error
    } finally {
      release()
    }
  }
}

export function createGraphQLClient(token: string): GraphQLClient {
  return new GraphQLClient(token)
}
