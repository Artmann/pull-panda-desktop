import type { UnknownAction } from '@reduxjs/toolkit'

import { filterReadyPullRequests } from '@/app/lib/pull-requests'
import { checksActions } from '@/app/store/checks-slice'
import { commentsActions } from '@/app/store/comments-slice'
import { commitsActions } from '@/app/store/commits-slice'
import { modifiedFilesActions } from '@/app/store/modified-files-slice'
import { pendingReviewsActions } from '@/app/store/pending-reviews-slice'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { reactionsActions } from '@/app/store/reactions-slice'
import { reviewsActions } from '@/app/store/reviews-slice'
import { reviewThreadsActions } from '@/app/store/review-threads-slice'
import type { ResourceUpdatedEvent } from '@/types/ipc-events'

// Maps a resource update event from the main process to the Redux action
// that applies it to the store.
export function resourceEventToAction(
  event: ResourceUpdatedEvent
): UnknownAction {
  switch (event.type) {
    case 'checks':
      return checksActions.setForPullRequest({
        pullRequestId: event.pullRequestId,
        items: event.data
      })

    case 'comments':
      return commentsActions.setForPullRequest({
        pullRequestId: event.pullRequestId,
        items: event.data
      })

    case 'commits':
      return commitsActions.setForPullRequest({
        pullRequestId: event.pullRequestId,
        items: event.data
      })

    case 'modified-files':
      return modifiedFilesActions.setForPullRequest({
        pullRequestId: event.pullRequestId,
        items: event.data
      })

    case 'pending-review':
      if (event.data) {
        return pendingReviewsActions.setReview({
          pullRequestId: event.pullRequestId,
          review: event.data
        })
      }

      return pendingReviewsActions.clearReview({
        pullRequestId: event.pullRequestId
      })

    case 'pull-request':
      return pullRequestsActions.upsertItem(event.data)

    case 'pull-requests':
      return pullRequestsActions.setItems(filterReadyPullRequests(event.data))

    case 'reactions':
      return reactionsActions.setForPullRequest({
        pullRequestId: event.pullRequestId,
        items: event.data
      })

    case 'reviews':
      return reviewsActions.setForPullRequest({
        pullRequestId: event.pullRequestId,
        items: event.data
      })

    case 'review-threads':
      return reviewThreadsActions.setForPullRequest({
        pullRequestId: event.pullRequestId,
        items: event.data
      })
  }
}
