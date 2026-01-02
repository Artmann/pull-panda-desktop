import { vi } from 'vitest'

import { createInMemoryDatabase, setDatabase } from '../database'
import type { createGraphqlClient } from './graphql'

export type GraphqlClient = ReturnType<typeof createGraphqlClient>

export function setupTestDatabase() {
  const db = createInMemoryDatabase()
  setDatabase(db)
  return db
}

export function teardownTestDatabase() {
  setDatabase(null)
}

export function createMockGraphqlClient() {
  return vi.fn() as unknown as GraphqlClient
}

export function createMockOctokit() {
  return {
    rest: {
      pulls: {
        listFiles: vi.fn()
      }
    }
  }
}

export const mockChecksResponse = {
  repository: {
    pullRequest: {
      commits: {
        nodes: [
          {
            commit: {
              oid: 'abc123',
              statusCheckRollup: {
                contexts: {
                  nodes: [
                    {
                      __typename: 'CheckRun',
                      id: 'check-1',
                      name: 'build',
                      conclusion: 'SUCCESS',
                      status: 'COMPLETED',
                      startedAt: '2024-01-01T10:00:00Z',
                      completedAt: '2024-01-01T10:05:00Z',
                      detailsUrl: 'https://github.com/actions/run/1',
                      summary: 'Build passed',
                      text: null,
                      checkSuite: {
                        workflowRun: {
                          workflow: {
                            name: 'CI'
                          }
                        }
                      }
                    },
                    {
                      __typename: 'CheckRun',
                      id: 'check-2',
                      name: 'test',
                      conclusion: 'FAILURE',
                      status: 'COMPLETED',
                      startedAt: '2024-01-01T10:00:00Z',
                      completedAt: '2024-01-01T10:10:00Z',
                      detailsUrl: 'https://github.com/actions/run/2',
                      summary: 'Tests failed',
                      text: '3 tests failed',
                      checkSuite: {
                        workflowRun: {
                          workflow: {
                            name: 'CI'
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        ]
      }
    }
  }
}

export const mockCommitsResponse = {
  repository: {
    pullRequest: {
      commits: {
        nodes: [
          {
            commit: {
              oid: 'commit-1',
              message: 'Initial commit',
              url: 'https://github.com/owner/repo/commit/commit-1',
              additions: 100,
              deletions: 50,
              authoredDate: '2024-01-01T09:00:00Z',
              author: {
                name: 'Test User',
                avatarUrl: 'https://avatars.githubusercontent.com/u/1',
                user: {
                  login: 'testuser'
                }
              }
            }
          },
          {
            commit: {
              oid: 'commit-2',
              message: 'Add feature\r\n\r\n\r\n\r\nWith description',
              url: 'https://github.com/owner/repo/commit/commit-2',
              additions: 25,
              deletions: 10,
              authoredDate: '2024-01-02T09:00:00Z',
              author: {
                name: 'Another User',
                avatarUrl: 'https://avatars.githubusercontent.com/u/2',
                user: {
                  login: 'anotheruser'
                }
              }
            }
          }
        ]
      }
    }
  }
}

export const mockFilesResponse = {
  data: [
    {
      filename: 'src/index.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      changes: 15,
      patch: '@@ -1,5 +1,10 @@\n+import { foo } from "./foo"'
    },
    {
      filename: 'src/new-file.ts',
      status: 'added',
      additions: 50,
      deletions: 0,
      changes: 50,
      patch: '@@ -0,0 +1,50 @@\n+export const newFeature = () => {}'
    },
    {
      filename: 'src/deleted.ts',
      status: 'removed',
      additions: 0,
      deletions: 30,
      changes: 30,
      patch: '@@ -1,30 +0,0 @@\n-// Removed file'
    }
  ]
}

export const mockReviewsResponse = {
  repository: {
    pullRequest: {
      reviews: {
        nodes: [
          {
            id: 'review-1',
            body: 'Looks good!',
            createdAt: '2024-01-01T11:00:00Z',
            state: 'APPROVED',
            submittedAt: '2024-01-01T11:05:00Z',
            url: 'https://github.com/owner/repo/pull/1#pullrequestreview-1',
            author: {
              login: 'reviewer1',
              avatarUrl: 'https://avatars.githubusercontent.com/u/10'
            },
            comments: {
              nodes: [
                {
                  id: 'review-comment-1',
                  body: 'Nice change here',
                  createdAt: '2024-01-01T11:02:00Z',
                  updatedAt: '2024-01-01T11:02:00Z',
                  url: 'https://github.com/owner/repo/pull/1#discussion_r1',
                  path: 'src/index.ts',
                  line: 5,
                  originalLine: 3,
                  diffHunk: '@@ -1,5 +1,10 @@\n+import { foo }',
                  commit: { oid: 'commit-1' },
                  originalCommit: { oid: 'commit-0' },
                  pullRequestReview: { id: 'review-1' },
                  replyTo: null as null,
                  author: {
                    login: 'reviewer1',
                    avatarUrl: 'https://avatars.githubusercontent.com/u/10'
                  },
                  reactions: {
                    nodes: [
                      {
                        id: 'reaction-1',
                        content: 'THUMBS_UP',
                        user: { id: 'user-1', login: 'testuser' }
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            id: 'review-2',
            body: 'Please fix these issues',
            createdAt: '2024-01-01T12:00:00Z',
            state: 'CHANGES_REQUESTED',
            submittedAt: '2024-01-01T12:05:00Z',
            url: 'https://github.com/owner/repo/pull/1#pullrequestreview-2',
            author: {
              login: 'reviewer2',
              avatarUrl: 'https://avatars.githubusercontent.com/u/11'
            },
            comments: {
              nodes: [] as unknown[]
            }
          }
        ]
      }
    }
  }
}

export const mockCommentsResponse = {
  repository: {
    pullRequest: {
      comments: {
        nodes: [
          {
            id: 'pr-comment-1',
            body: 'This is a PR-level comment',
            createdAt: '2024-01-01T10:00:00Z',
            updatedAt: '2024-01-01T10:00:00Z',
            url: 'https://github.com/owner/repo/pull/1#issuecomment-1',
            author: {
              login: 'commenter1',
              avatarUrl: 'https://avatars.githubusercontent.com/u/20'
            },
            reactions: {
              nodes: [
                {
                  id: 'reaction-pr-1',
                  content: 'HEART',
                  user: { id: 'user-5', login: 'liker' }
                }
              ]
            }
          }
        ]
      },
      reviewThreads: {
        nodes: [
          {
            id: 'thread-1',
            comments: {
              nodes: [
                {
                  id: 'thread-comment-1',
                  body: 'This needs refactoring',
                  createdAt: '2024-01-01T13:00:00Z',
                  updatedAt: '2024-01-01T13:00:00Z',
                  url: 'https://github.com/owner/repo/pull/1#discussion_r100',
                  path: 'src/utils.ts',
                  line: 10,
                  originalLine: 8,
                  diffHunk: '@@ -5,10 +5,15 @@\n function old() {\n+function new() {',
                  commit: { oid: 'commit-2' },
                  originalCommit: { oid: 'commit-1' },
                  pullRequestReview: { id: 'review-2' },
                  replyTo: null as null,
                  author: {
                    login: 'reviewer2',
                    avatarUrl: 'https://avatars.githubusercontent.com/u/11'
                  },
                  reactions: {
                    nodes: [] as unknown[]
                  }
                },
                {
                  id: 'thread-comment-2',
                  body: 'I agree, will fix',
                  createdAt: '2024-01-01T14:00:00Z',
                  updatedAt: '2024-01-01T14:00:00Z',
                  url: 'https://github.com/owner/repo/pull/1#discussion_r101',
                  path: 'src/utils.ts',
                  line: 10,
                  originalLine: 8,
                  diffHunk: '@@ -5,10 +5,15 @@\n function old() {\n+function new() {',
                  commit: { oid: 'commit-2' },
                  originalCommit: { oid: 'commit-1' },
                  pullRequestReview: null as null,
                  replyTo: { id: 'thread-comment-1' },
                  author: {
                    login: 'author',
                    avatarUrl: 'https://avatars.githubusercontent.com/u/1'
                  },
                  reactions: {
                    nodes: [] as unknown[]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  }
}
