import { ChevronDown, ChevronUp } from 'lucide-react'
import { memo, ReactElement } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import { createReview } from '@/app/lib/api'
import {
  createOptimisticReview,
  useClearPendingReview,
  usePendingReview,
  useSetPendingReview
} from '@/app/lib/queries/use-pending-review'
import { PullRequest } from '@/types/pull-request'

interface PullRequestToolbarProps {
  pullRequest: PullRequest
}

export const PullRequestToolbar = memo(function PullRequestToolbar({
  pullRequest
}: PullRequestToolbarProps): ReactElement {
  const pendingReview = usePendingReview(pullRequest.id)
  const setPendingReview = useSetPendingReview()
  const clearPendingReview = useClearPendingReview()

  const hasPendingReview = Boolean(pendingReview)

  const handleStartReview = () => {
    if (hasPendingReview) {
      return
    }

    const optimisticReview = createOptimisticReview(pullRequest.id)

    setPendingReview(pullRequest.id, optimisticReview)

    createReview({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      repo: pullRequest.repositoryName
    })
      .then((review) => {
        setPendingReview(pullRequest.id, {
          ...review,
          pullRequestId: pullRequest.id
        })
      })
      .catch((error) => {
        console.error('Failed to start review:', error)

        clearPendingReview(pullRequest.id)

        const message =
          error instanceof Error ? error.message : 'Failed to start review'

        toast.error(message)
      })
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

      {!pullRequest.isAuthor && (
        <>
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
        </>
      )}
    </div>
  )
})
