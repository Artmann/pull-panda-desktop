import { configureStore } from '@reduxjs/toolkit'

import type { MergeOptions } from '@/app/lib/api'
import checksReducer from '@/app/store/checks-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import modifiedFilesReducer from '@/app/store/modified-files-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import recentReviewersReducer, {
  type RecentReviewer
} from '@/app/store/recent-reviewers-slice'
import reviewsReducer from '@/app/store/reviews-slice'
import type { PullRequest } from '@/types/pull-request'
import type { Check, ModifiedFile, Review } from '@/types/pull-request-details'

const win = window as unknown as {
  electron?: { getApiPort: () => Promise<number | null> }
}

if (!win.electron) {
  win.electron = { getApiPort: () => Promise.resolve(null) }
}

export const reviewerStoryPullRequest: PullRequest = {
  approvalCount: 0,
  assignees: [],
  authorAvatarUrl: null,
  authorLogin: 'octocat',
  body: null,
  bodyHtml: null,
  changesRequestedCount: 0,
  closedAt: null,
  commentCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  detailsSyncedAt: null,
  headRefName: 'feature/branch',
  baseRefName: null,
  id: 'pr-1',
  isAssignee: false,
  isAuthor: false,
  isDraft: false,
  isReviewer: false,
  labels: [],
  lastViewedAt: null,
  mergedAt: null,
  number: 42,
  repositoryName: 'demo',
  repositoryOwner: 'octocat',
  requestedReviewers: [],
  state: 'OPEN',
  syncedAt: '2026-01-01T00:00:00Z',
  title: 'Demo PR',
  updatedAt: '2026-01-01T00:00:00Z',
  url: 'https://example.com'
}

export function buildCheck(overrides: Partial<Check> = {}): Check {
  return {
    commitSha: 'abc123',
    conclusion: 'success',
    detailsUrl: null,
    durationInSeconds: 42,
    gitHubCreatedAt: '2026-01-01T00:00:00Z',
    gitHubId: 'gh-check',
    gitHubUpdatedAt: '2026-01-01T00:01:00Z',
    id: 'check-1',
    message: null,
    name: 'build',
    pullRequestId: 'pr-1',
    state: 'completed',
    suiteName: 'CI',
    syncedAt: '2026-01-01T00:00:00Z',
    url: null,
    ...overrides
  }
}

export function buildModifiedFile(
  overrides: Partial<ModifiedFile> = {}
): ModifiedFile {
  return {
    additions: 10,
    blobSha: null,
    changes: 15,
    deletions: 5,
    diffHunk: null,
    filename: 'index.ts',
    filePath: 'src/index.ts',
    id: 'file-1',
    previousFilename: null,
    pullRequestId: 'pr-1',
    status: 'modified',
    syncedAt: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

export function buildReviewerStoryStore(args?: {
  checks?: Check[]
  mergeOptions?: MergeOptions | null
  modifiedFiles?: ModifiedFile[]
  pullRequest?: PullRequest
  recents?: Record<string, RecentReviewer[]>
  reviews?: Review[]
}) {
  const defaultChecks: Check[] = []
  const defaultFiles: ModifiedFile[] = []
  const defaultMergeOptions: MergeOptions | null = null
  const defaultRecents: Record<string, RecentReviewer[]> = {}
  const defaultReviews: Review[] = []
  const options = {
    checks: defaultChecks,
    mergeOptions: defaultMergeOptions,
    modifiedFiles: defaultFiles,
    pullRequest: reviewerStoryPullRequest,
    recents: defaultRecents,
    reviews: defaultReviews,
    ...args
  }

  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false
      }),
    preloadedState: {
      checks: { items: options.checks },
      mergeOptions: { [options.pullRequest.id]: options.mergeOptions },
      modifiedFiles: { items: options.modifiedFiles },
      pullRequests: { initialized: true, items: [options.pullRequest] },
      recentReviewers: { byRepo: options.recents },
      reviews: { items: options.reviews }
    },
    reducer: {
      checks: checksReducer,
      mergeOptions: mergeOptionsReducer,
      modifiedFiles: modifiedFilesReducer,
      pullRequests: pullRequestsReducer,
      recentReviewers: recentReviewersReducer,
      reviews: reviewsReducer
    }
  })
}
