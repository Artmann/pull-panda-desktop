import { graphql } from '@octokit/graphql'

import type { GitHubPullRequest, PullRequestSearchResult } from './types'

export function createGraphqlClient(token: string) {
  return graphql.defaults({
    headers: {
      authorization: `token ${token}`
    }
  })
}

const searchQuery = `
  query SearchPullRequests($searchFilter: String!, $cursor: String) {
    search(query: $searchFilter, type: ISSUE, first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          id
          number
          title
          state
          url
          createdAt
          updatedAt
          closedAt
          mergedAt
          author {
            login
            avatarUrl
          }
          repository {
            owner {
              login
            }
            name
          }
          labels(first: 20) {
            nodes {
              name
              color
            }
          }
          assignees(first: 10) {
            nodes {
              login
              avatarUrl
            }
          }
        }
      }
    }
  }
`

async function fetchPullRequestsByQuery(
  client: ReturnType<typeof graphql.defaults>,
  searchFilter: string
): Promise<GitHubPullRequest[]> {
  const results: GitHubPullRequest[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const response = await client<PullRequestSearchResult>(searchQuery, {
      searchFilter,
      cursor
    })

    const pullRequests = response.search.nodes.filter(
      (node): node is GitHubPullRequest => node !== null && 'id' in node
    )

    results.push(...pullRequests)

    hasNextPage = response.search.pageInfo.hasNextPage
    cursor = response.search.pageInfo.endCursor
  }

  return results
}

export async function fetchAuthoredPullRequests(
  client: ReturnType<typeof graphql.defaults>
): Promise<GitHubPullRequest[]> {
  return fetchPullRequestsByQuery(client, 'is:pr author:@me is:open')
}

export async function fetchAssignedPullRequests(
  client: ReturnType<typeof graphql.defaults>
): Promise<GitHubPullRequest[]> {
  return fetchPullRequestsByQuery(client, 'is:pr assignee:@me is:open')
}

export async function fetchReviewRequestedPullRequests(
  client: ReturnType<typeof graphql.defaults>
): Promise<GitHubPullRequest[]> {
  return fetchPullRequestsByQuery(client, 'is:pr review-requested:@me is:open')
}
