import { configureStore } from '@reduxjs/toolkit'

import pullRequestsReducer from '@/app/store/pull-requests-slice'
import recentReviewersReducer, {
  type RecentReviewer
} from '@/app/store/recent-reviewers-slice'
import reviewsReducer from '@/app/store/reviews-slice'
import type { PullRequest } from '@/types/pull-request'
import type { Review } from '@/types/pull-request-details'

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
  id: 'pr-1',
  isAssignee: false,
  isAuthor: false,
  isDraft: false,
  isReviewer: false,
  labels: [],
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

export function buildReviewerStoryStore(args?: {
  pullRequest?: PullRequest
  recents?: Record<string, RecentReviewer[]>
  reviews?: Review[]
}) {
  const defaultRecents: Record<string, RecentReviewer[]> = {}
  const defaultReviews: Review[] = []
  const options = {
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
      pullRequests: { initialized: true, items: [options.pullRequest] },
      recentReviewers: { byRepo: options.recents },
      reviews: { items: options.reviews }
    },
    reducer: {
      pullRequests: pullRequestsReducer,
      recentReviewers: recentReviewersReducer,
      reviews: reviewsReducer
    }
  })
}
