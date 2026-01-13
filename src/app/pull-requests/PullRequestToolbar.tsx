import { ChevronDown, ChevronUp } from 'lucide-react'
import { ReactElement } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import { createReview } from '@/app/lib/api'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  createOptimisticReview,
  pendingReviewsActions
} from '@/app/store/pending-reviews-slice'
import { PullRequest } from '@/types/pull-request'

interface PullRequestToolbarProps {
  pullRequest: PullRequest
}

export function PullRequestToolbar({
  pullRequest
}: PullRequestToolbarProps): ReactElement {
  const dispatch = useAppDispatch()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )

  const hasPendingReview = Boolean(pendingReview)

  const handleStartReview = async () => {
    if (hasPendingReview) {
      return
    }

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
            pullRequestId: pullRequest.id
          }
        })
      )
    } catch (error) {
      console.error('Failed to start review:', error)

      dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )

      const message =
        error instanceof Error ? error.message : 'Failed to start review'

      toast.error(message)
    }
  }

  return (
    <div
      className={`
        fixed bottom-10 left-1/2 -translate-x-1/2 z-30
        bg-background
        rounded-sm border border-border shadow-sm
        p-1.5
        flex items-center gap-2
    `}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
        >
          <ChevronDown className="size-3" />
        </Button>

        <Button
          variant="outline"
          size="icon-xs"
        >
          <ChevronUp className="size-3" />
        </Button>
      </div>

      <Separator orientation="vertical" />

      <div className="flex items-center gap-1">
        {hasPendingReview ? (
          <Button
            size="xs"
            variant="outline"
          >
            Review in progress
          </Button>
        ) : (
          <Button
            onClick={handleStartReview}
            size="xs"
          >
            Start review
          </Button>
        )}
      </div>
    </div>
  )
}
