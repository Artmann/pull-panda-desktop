export const checksQuery = `
  query GetPullRequestChecks($owner: String!, $repo: String!, $pullNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pullNumber) {
        commits(last: 1) {
          nodes {
            commit {
              oid
              statusCheckRollup {
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      id
                      name
                      conclusion
                      status
                      startedAt
                      completedAt
                      detailsUrl
                      summary
                      text
                      checkSuite {
                        workflowRun {
                          workflow {
                            name
                          }
                        }
                      }
                    }
                    ... on StatusContext {
                      id
                      context
                      state
                      description
                      targetUrl
                      createdAt
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export const reviewsQuery = `
  query GetPullRequestReviews($owner: String!, $repo: String!, $pullNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pullNumber) {
        reviews(first: 80) {
          nodes {
            id
            body
            createdAt
            state
            submittedAt
            url
            author {
              login
              avatarUrl
            }
            comments(first: 80) {
              nodes {
                author {
                  login
                  avatarUrl
                }
                body
                commit {
                  oid
                }
                createdAt
                diffHunk
                id
                line
                originalCommit {
                  oid
                }
                originalLine
                path
                pullRequestReview {
                  id
                }
                replyTo {
                  id
                }
                reactions(first: 50) {
                  nodes {
                    content
                    id
                    user {
                      id
                      login
                    }
                  }
                }
                updatedAt
                url
              }
            }
          }
        }
      }
    }
  }
`

export const commentsQuery = `
  query GetPullRequestComments($owner: String!, $repo: String!, $pullNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pullNumber) {
        comments(first: 80) {
          nodes {
            author {
              login
              avatarUrl
            }
            body
            createdAt
            id
            updatedAt
            url
            reactions(first: 50) {
              nodes {
                id
                content
                user {
                  id
                  login
                }
              }
            }
          }
        }
        reviewThreads(first: 80) {
          nodes {
            id
            comments(first: 80) {
              nodes {
                body
                commit {
                  oid
                }
                createdAt
                diffHunk
                id
                line
                originalCommit {
                  oid
                }
                originalLine
                path
                pullRequestReview {
                  id
                }
                replyTo {
                  id
                }
                updatedAt
                url
                author {
                  login
                  avatarUrl
                }
                reactions(first: 50) {
                  nodes {
                    id
                    content
                    user {
                      id
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export const commitsQuery = `
  query GetPullRequestCommits($owner: String!, $repo: String!, $pullNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pullNumber) {
        commits(first: 100) {
          nodes {
            commit {
              oid
              message
              author {
                name
                avatarUrl
                user {
                  login
                }
              }
              authoredDate
              url
              additions
              deletions
            }
          }
        }
      }
    }
  }
`

export interface ChecksQueryResponse {
  repository?: {
    pullRequest?: {
      commits?: {
        nodes?: Array<{
          commit: {
            oid: string
            statusCheckRollup?: {
              contexts?: {
                nodes?: Array<{
                  __typename: string
                  id: string
                  name?: string
                  conclusion?: string
                  status?: string
                  startedAt?: string
                  completedAt?: string
                  detailsUrl?: string
                  summary?: string
                  text?: string
                  checkSuite?: {
                    workflowRun?: {
                      workflow?: {
                        name?: string
                      }
                    }
                  }
                  context?: string
                  state?: string
                  description?: string
                  targetUrl?: string
                  createdAt?: string
                } | null> | null
              } | null
            } | null
          }
        } | null> | null
      } | null
    } | null
  } | null
}

export interface ReviewsQueryResponse {
  repository?: {
    pullRequest?: {
      reviews?: {
        nodes?: Array<{
          id: string
          body?: string
          createdAt?: string
          state?: string
          submittedAt?: string
          url?: string
          author?: {
            login: string
            avatarUrl: string
          }
          comments: {
            nodes?: Array<{
              id: string
              body?: string
              createdAt?: string
              updatedAt?: string
              url?: string
              path?: string
              line?: number
              originalLine?: number
              diffHunk?: string
              commit?: { oid: string }
              originalCommit?: { oid: string }
              pullRequestReview?: { id: string }
              replyTo?: { id: string }
              author?: {
                login: string
                avatarUrl: string
              }
              reactions: {
                nodes?: Array<{
                  id: string
                  content: string
                  user?: { id: string; login: string }
                } | null> | null
              }
            } | null> | null
          }
        } | null> | null
      } | null
    } | null
  } | null
}

export interface CommentsQueryResponse {
  repository?: {
    pullRequest?: {
      comments?: {
        nodes?: Array<{
          id: string
          body?: string
          createdAt?: string
          updatedAt?: string
          url?: string
          author?: {
            login: string
            avatarUrl: string
          }
          reactions: {
            nodes?: Array<{
              id: string
              content: string
              user?: { id: string; login: string }
            } | null> | null
          }
        } | null> | null
      } | null
      reviewThreads?: {
        nodes?: Array<{
          id: string
          comments: {
            nodes?: Array<{
              id: string
              body?: string
              createdAt?: string
              updatedAt?: string
              url?: string
              path?: string
              line?: number
              originalLine?: number
              diffHunk?: string
              commit?: { oid: string }
              originalCommit?: { oid: string }
              pullRequestReview?: { id: string }
              replyTo?: { id: string }
              author?: {
                login: string
                avatarUrl: string
              }
              reactions: {
                nodes?: Array<{
                  id: string
                  content: string
                  user?: { id: string; login: string }
                } | null> | null
              }
            } | null> | null
          }
        } | null> | null
      } | null
    } | null
  } | null
}

export interface CommitsQueryResponse {
  repository?: {
    pullRequest?: {
      commits?: {
        nodes?: Array<{
          commit: {
            oid: string
            message?: string
            url?: string
            additions?: number
            deletions?: number
            authoredDate?: string
            author?: {
              name?: string
              avatarUrl?: string
              user?: { login?: string }
            }
          }
        } | null> | null
      } | null
    } | null
  } | null
}
