import { toast } from 'sonner'

import { createReview } from '@/app/lib/api'
import {
  createOptimisticReview,
  pendingReviewsActions
} from '@/app/store/pending-reviews-slice'

import { commandRegistry } from '../registry'
import { getStore } from '../store-accessor'

// Start review command
commandRegistry.register({
  id: 'review.start',
  label: 'Start review',
  group: 'review',
  shortcut: { key: 'r' },
  isAvailable: (ctx) => {
    if (ctx.view !== 'pr-detail' || !ctx.pullRequest) return false

    // Check if there's already a pending review
    const state = getStore().getState()
    return !state.pendingReviews[ctx.pullRequest.id]
  },
  execute: async (ctx) => {
    if (!ctx.pullRequest) return

    const pullRequest = ctx.pullRequest
    const optimisticReview = createOptimisticReview(pullRequest.id)

    // Optimistic update
    getStore().dispatch(
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

      getStore().dispatch(
        pendingReviewsActions.setReview({
          pullRequestId: pullRequest.id,
          review: {
            ...review,
            pullRequestId: pullRequest.id
          }
        })
      )
    } catch (error) {
      console.error('Failed to start review:', error)

      getStore().dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )

      const message =
        error instanceof Error ? error.message : 'Failed to start review'

      toast.error(message)
    }
  }
})
