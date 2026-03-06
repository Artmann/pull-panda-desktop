import { MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'

import { createReview } from '@/app/lib/api'
import { getQueryClient } from '@/app/lib/query-client-accessor'
import { queryKeys } from '@/app/lib/query-keys'
import {
  createOptimisticReview,
  type PendingReview
} from '@/app/lib/queries/use-pending-review'

import { commandRegistry } from '../registry'

// Start review command
commandRegistry.register({
  id: 'review.start',
  label: 'Start Review',
  icon: MessageSquarePlus,
  group: 'pull request',
  shortcut: { key: 'r' },
  isAvailable: (ctx) => {
    if (ctx.view !== 'pr-detail' || !ctx.pullRequest) return false

    const queryClient = getQueryClient()
    const pendingReview = queryClient.getQueryData<PendingReview | null>(
      queryKeys.pendingReviews.byPullRequest(ctx.pullRequest.id)
    )

    return !pendingReview
  },
  execute: (ctx) => {
    if (!ctx.pullRequest) return

    const queryClient = getQueryClient()
    const pullRequest = ctx.pullRequest
    const optimisticReview = createOptimisticReview(pullRequest.id)

    // Optimistic update
    queryClient.setQueryData(
      queryKeys.pendingReviews.byPullRequest(pullRequest.id),
      optimisticReview
    )

    createReview({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      repo: pullRequest.repositoryName
    })
      .then((review) => {
        queryClient.setQueryData(
          queryKeys.pendingReviews.byPullRequest(pullRequest.id),
          {
            ...review,
            pullRequestId: pullRequest.id
          }
        )
      })
      .catch((error) => {
        console.error('Failed to start review:', error)

        queryClient.setQueryData(
          queryKeys.pendingReviews.byPullRequest(pullRequest.id),
          null
        )

        const message =
          error instanceof Error ? error.message : 'Failed to start review'

        toast.error(message)
      })
  }
})
