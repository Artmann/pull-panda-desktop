import { MessageSquarePlus } from 'lucide-react'
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
  label: 'Start Review',
  icon: MessageSquarePlus,
  group: 'pull request',
  shortcut: { key: 'r' },
  isAvailable: (ctx) => {
    const store = getStore()

    if (ctx.view !== 'pr-detail' || !ctx.pullRequest || !store) return false

    // Check if there's already a pending review
    const state = store.getState()

    return !state.pendingReviews[ctx.pullRequest.id]
  },
  execute: async (ctx) => {
    const store = getStore()

    if (!ctx.pullRequest || !store) return

    const pullRequest = ctx.pullRequest
    const optimisticReview = createOptimisticReview(pullRequest.id)

    // Optimistic update
    store.dispatch(
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

      store.dispatch(
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

      store.dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )

      const message =
        error instanceof Error ? error.message : 'Failed to start review'

      toast.error(message)
    }
  }
})
