import type { Check, ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

export function createMockCheck(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    gitHubId: 'CR_kwDOExample123',
    pullRequestId: 'pr-1',
    name: 'build',
    state: 'completed',
    conclusion: 'success',
    commitSha: 'abc1234567890',
    suiteName: 'GitHub Actions',
    durationInSeconds: 120,
    detailsUrl: 'https://github.com/owner/repo/actions/runs/123',
    message: 'Build completed successfully',
    url: 'https://github.com/owner/repo/actions/runs/123',
    gitHubCreatedAt: '2024-01-01T00:00:00Z',
    gitHubUpdatedAt: '2024-01-01T00:02:00Z',
    syncedAt: '2024-01-01T00:02:00Z',
    ...overrides
  }
}

export function createMockModifiedFile(
  overrides: Partial<ModifiedFile> = {}
): ModifiedFile {
  return {
    id: 'file-1',
    pullRequestId: 'pr-1',
    filename: 'index.ts',
    filePath: 'src/index.ts',
    previousFilename: null,
    status: 'modified',
    additions: 10,
    deletions: 5,
    changes: 15,
    diffHunk: '@@ -1,5 +1,5 @@\n context\n-old line\n+new line',
    blobSha: null,
    syncedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

export function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 42,
    title: 'Test PR',
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/42',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    authorLogin: 'testuser',
    authorAvatarUrl: 'https://example.com/avatar.png',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    body: 'Test PR body',
    bodyHtml: null,
    headRefName: null,
    isDraft: false,
    isAuthor: false,
    isAssignee: false,
    isReviewer: false,
    labels: [],
    assignees: [],
    requestedReviewers: [],
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: null,
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}
