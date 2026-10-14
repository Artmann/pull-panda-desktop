import { configureStore } from '@reduxjs/toolkit'

import type { MergeOptions } from '@/app/lib/api'
import checksReducer from '@/app/store/checks-slice'
import commitsReducer from '@/app/store/commits-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import modifiedFilesReducer from '@/app/store/modified-files-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import recentReviewersReducer, {
  type RecentReviewer
} from '@/app/store/recent-reviewers-slice'
import reviewsReducer from '@/app/store/reviews-slice'
import type { PullRequest } from '@/types/pull-request'
import type {
  Check,
  Commit,
  ModifiedFile,
  Review
} from '@/types/pull-request-details'

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
  hiddenAt: null,
  labels: [],
  lastViewedAt: null,
  mergedAt: null,
  number: 42,
  repositoryName: 'demo',
  repositoryOwner: 'octocat',
  requestedReviewers: [],
  reviewDecision: null,
  state: 'OPEN',
  syncedAt: '2026-01-01T00:00:00Z',
  title: 'Demo PR',
  updatedAt: '2026-01-01T00:00:00Z',
  url: 'https://example.com'
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
  commits?: Commit[]
  mergeOptions?: MergeOptions | null
  modifiedFiles?: ModifiedFile[]
  pullRequest?: PullRequest
  recents?: Record<string, RecentReviewer[]>
  reviews?: Review[]
}) {
  const defaultChecks: Check[] = []
  const defaultCommits: Commit[] = []
  const defaultFiles: ModifiedFile[] = []
  const defaultMergeOptions: MergeOptions | null = null
  const defaultRecents: Record<string, RecentReviewer[]> = {}
  const defaultReviews: Review[] = []
  const options = {
    checks: defaultChecks,
    commits: defaultCommits,
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
      commits: { items: options.commits },
      mergeOptions: { [options.pullRequest.id]: options.mergeOptions },
      modifiedFiles: { items: options.modifiedFiles },
      pullRequests: { initialized: true, items: [options.pullRequest] },
      recentReviewers: { byRepo: options.recents },
      reviews: { items: options.reviews }
    },
    reducer: {
      checks: checksReducer,
      commits: commitsReducer,
      mergeOptions: mergeOptionsReducer,
      modifiedFiles: modifiedFilesReducer,
      pullRequests: pullRequestsReducer,
      recentReviewers: recentReviewersReducer,
      reviews: reviewsReducer
    }
  })
}
