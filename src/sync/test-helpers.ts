import { createInMemoryDatabase, setDatabase } from '../database'

let testDb: Awaited<ReturnType<typeof createInMemoryDatabase>> | null = null

export async function setupTestDatabase() {
  testDb = await createInMemoryDatabase()
  setDatabase(testDb)

  return testDb
}

export function setupTestDatabaseSync() {
  // For backwards compatibility - will throw if called before async init
  if (!testDb) {
    throw new Error(
      'Database not initialized. Call setupTestDatabase() in beforeAll()'
    )
  }

  setDatabase(testDb)

  return testDb
}

export function teardownTestDatabase() {
  setDatabase(null)
  testDb = null
}

// REST API mock response for commits
export const mockRestCommitsResponse = {
  data: [
    {
      sha: 'commit-1',
      commit: {
        message: 'Initial commit',
        author: {
          name: 'Test User',
          date: '2024-01-01T09:00:00Z'
        }
      },
      html_url: 'https://github.com/owner/repo/commit/commit-1',
      author: {
        login: 'testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/1'
      }
    },
    {
      sha: 'commit-2',
      commit: {
        message: 'Add feature\r\n\r\n\r\n\r\nWith description',
        author: {
          name: 'Another User',
          date: '2024-01-02T09:00:00Z'
        }
      },
      html_url: 'https://github.com/owner/repo/commit/commit-2',
      author: {
        login: 'anotheruser',
        avatar_url: 'https://avatars.githubusercontent.com/u/2'
      }
    }
  ],
  headers: {
    'x-ratelimit-remaining': '4999',
    'x-ratelimit-limit': '5000',
    'x-ratelimit-reset': '1704067200'
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
  ],
  headers: {
    'x-ratelimit-remaining': '4999',
    'x-ratelimit-limit': '5000',
    'x-ratelimit-reset': '1704067200'
  }
}

// REST API mock responses for check runs
export const mockRestCheckRunsResponse = {
  total_count: 2,
  check_runs: [
    {
      id: 1,
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      started_at: '2024-01-01T10:00:00Z',
      completed_at: '2024-01-01T10:05:00Z',
      details_url: 'https://github.com/actions/run/1',
      head_sha: 'abc123',
      output: {
        title: 'Build',
        summary: 'Build passed'
      },
      app: {
        name: 'GitHub Actions'
      }
    },
    {
      id: 2,
      name: 'test',
      status: 'completed',
      conclusion: 'failure',
      started_at: '2024-01-01T10:00:00Z',
      completed_at: '2024-01-01T10:10:00Z',
      details_url: 'https://github.com/actions/run/2',
      head_sha: 'abc123',
      output: {
        title: 'Tests',
        summary: 'Tests failed'
      },
      app: {
        name: 'GitHub Actions'
      }
    }
  ]
}

// REST API mock response for reviews
export const mockRestReviewsResponse = [
  {
    id: 1,
    node_id: 'review-1',
    state: 'APPROVED',
    body: 'Looks good!',
    body_html: '<p>Looks good!</p>',
    html_url: 'https://github.com/owner/repo/pull/1#pullrequestreview-1',
    submitted_at: '2024-01-01T11:05:00Z',
    commit_id: 'abc123',
    user: {
      login: 'reviewer1',
      avatar_url: 'https://avatars.githubusercontent.com/u/10'
    }
  },
  {
    id: 2,
    node_id: 'review-2',
    state: 'CHANGES_REQUESTED',
    body: 'Please fix these issues',
    body_html: '<p>Please fix these issues</p>',
    html_url: 'https://github.com/owner/repo/pull/1#pullrequestreview-2',
    submitted_at: '2024-01-01T12:05:00Z',
    commit_id: 'abc123',
    user: {
      login: 'reviewer2',
      avatar_url: 'https://avatars.githubusercontent.com/u/11'
    }
  }
]

// REST API mock response for review comments
export const mockRestReviewCommentsResponse = [
  {
    id: 1,
    node_id: 'review-comment-1',
    pull_request_review_id: 1,
    body: 'Nice change here',
    body_html: '<p>Nice change here</p>',
    path: 'src/index.ts',
    line: 5,
    original_line: 3,
    diff_hunk: '@@ -1,5 +1,10 @@\n+import { foo }',
    commit_id: 'abc123',
    original_commit_id: 'def456',
    html_url: 'https://github.com/owner/repo/pull/1#discussion_r1',
    created_at: '2024-01-01T11:02:00Z',
    updated_at: '2024-01-01T11:02:00Z',
    user: {
      login: 'reviewer1',
      avatar_url: 'https://avatars.githubusercontent.com/u/10',
      id: 10
    },
    reactions: {
      url: 'https://api.github.com/repos/owner/repo/pulls/comments/1/reactions',
      total_count: 1
    }
  }
]

// REST API mock response for issue comments
export const mockRestIssueCommentsResponse = [
  {
    id: 1,
    node_id: 'issue-comment-1',
    body: 'This is a PR-level comment',
    body_html: '<p>This is a PR-level comment</p>',
    html_url: 'https://github.com/owner/repo/pull/1#issuecomment-1',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
    user: {
      login: 'commenter1',
      avatar_url: 'https://avatars.githubusercontent.com/u/20',
      id: 20
    },
    reactions: {
      url: 'https://api.github.com/repos/owner/repo/issues/comments/1/reactions',
      total_count: 1
    }
  }
]
