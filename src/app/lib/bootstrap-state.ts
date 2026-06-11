import type { PreloadedState } from '@/app/store'
import type { BootstrapData } from '@/main/bootstrap'

import { filterReadyPullRequests } from './pull-requests'

export function buildPreloadedState(
  bootstrapData: BootstrapData | null
): PreloadedState {
  if (!bootstrapData) {
    return buildEmptyPreloadedState()
  }

  return {
    checks: { items: bootstrapData.checks },
    comments: { items: bootstrapData.comments },
    commits: { items: bootstrapData.commits },
    connectedRepos: {
      byFullName: bootstrapData.connectedRepos,
      checkoutsInProgress: {},
      initialized: true
    },
    modifiedFiles: { items: bootstrapData.modifiedFiles },
    pendingReviews: bootstrapData.pendingReviews,
    pullRequests: {
      initialized: true,
      items: filterReadyPullRequests(bootstrapData.pullRequests)
    },
    reactions: { items: bootstrapData.reactions },
    reviews: { items: bootstrapData.reviews },
    reviewThreads: { items: bootstrapData.reviewThreads }
  }
}

function buildEmptyPreloadedState(): PreloadedState {
  return {
    checks: { items: [] },
    comments: { items: [] },
    commits: { items: [] },
    connectedRepos: {
      byFullName: {},
      checkoutsInProgress: {},
      initialized: true
    },
    modifiedFiles: { items: [] },
    pendingReviews: {},
    pullRequests: { initialized: true, items: [] },
    reactions: { items: [] },
    reviews: { items: [] },
    reviewThreads: { items: [] }
  }
}
