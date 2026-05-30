import { toast } from 'sonner'

import { createReview } from '@/app/lib/api'
import type { AppDispatch } from '@/app/store'
import {
  createOptimisticReview,
  pendingReviewsActions
} from '@/app/store/pending-reviews-slice'
import type { PullRequest } from '@/types/pull-request'

export async function startPendingReview({
  dispatch,
  pullRequest
}: {
  dispatch: AppDispatch
  pullRequest: PullRequest
}): Promise<boolean> {
  const optimisticReview = createOptimisticReview(pullRequest.id)

  dispatch(
    pendingReviewsActions.setReview({
      pullRequestId: pullRequest.id,
      review: optimisticReview
    })
  )

  try {
    const review = await createReview({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      repo: pullRequest.repositoryName
    })

    dispatch(
      pendingReviewsActions.setReview({
        pullRequestId: pullRequest.id,
        review: {
          ...review,
          isCollapsed: false,
          pullRequestId: pullRequest.id
        }
      })
    )

    return true
  } catch (error) {
    console.error('Failed to start review:', error)

    dispatch(
      pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
    )

    const message =
      error instanceof Error ? error.message : 'Failed to start review'

    toast.error(message)

    return false
  }
}
