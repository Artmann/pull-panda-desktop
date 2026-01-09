import { graphql } from '@octokit/graphql'
import { GraphqlResponseError } from '@octokit/graphql'
import { log } from 'tiny-typescript-logger'

import { rateLimitManager, isRateLimitError, sleep } from './rate-limit-manager'

export interface GraphQLRateLimit {
  limit: number
  remaining: number
  resetAt: string
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
    // Check if we should pause before making the request
    if (rateLimitManager.shouldPause('graphql')) {
      const waitMs = rateLimitManager.getWaitTimeMs('graphql')

      log.info(
        `[GraphQL] Rate limit low, waiting ${Math.round(waitMs / 1000)}s until reset`
      )

      await sleep(waitMs)
    }

    try {
      const response = await this.client<T & { rateLimit?: GraphQLRateLimit }>(
        query,
        variables
      )

      // Update rate limit from response
      if (response.rateLimit) {
        rateLimitManager.updateFromGraphQL(response.rateLimit)
      }

      return response
    } catch (error) {
      // Handle rate limit errors with retry
      if (isRateLimitError(error)) {
        const graphqlError = error as GraphqlResponseError<unknown>
        const resetAt = graphqlError.headers?.['x-ratelimit-reset']
        const waitMs = resetAt
          ? (parseInt(resetAt, 10) - Math.floor(Date.now() / 1000) + 5) * 1000
          : 60000

        log.info(
          `[GraphQL] Rate limited, waiting ${Math.round(waitMs / 1000)}s before retry`
        )

        await sleep(waitMs)

        // Retry the request
        return this.query<T>(query, variables)
      }

      throw error
    }
  }
}

export function createGraphQLClient(token: string): GraphQLClient {
  return new GraphQLClient(token)
}
