import { ChevronDown, ChevronUp, GitMergeIcon, Loader2 } from 'lucide-react'
import { memo, ReactElement, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import { createReview, getMergeOptions } from '@/app/lib/api'
import type { MergeOptions } from '@/app/lib/api'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  createOptimisticReview,
  pendingReviewsActions
} from '@/app/store/pending-reviews-slice'
import { PullRequest } from '@/types/pull-request'

interface PullRequestToolbarProps {
  onOpenMergeDrawer: () => void
  pullRequest: PullRequest
}

export const PullRequestToolbar = memo(function PullRequestToolbar({
  onOpenMergeDrawer,
  pullRequest
}: PullRequestToolbarProps): ReactElement {
  const dispatch = useAppDispatch()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )

  const hasPendingReview = Boolean(pendingReview)

  const [mergeOptions, setMergeOptions] = useState<MergeOptions | null>(null)

  useEffect(
    function fetchMergeOptionsForLabel() {
      if (pullRequest.state !== 'OPEN') {
        return
      }

      let cancelled = false
      let retryTimeout: ReturnType<typeof setTimeout> | null = null

      const fetch = () => {
        getMergeOptions(pullRequest.id)
          .then((options) => {
            if (cancelled) return

            setMergeOptions(options)

            if (options.mergeable === null) {
              retryTimeout = setTimeout(fetch, 3000)
            }
          })
          .catch(() => {
            // Silently fail — merge button just won't appear.
          })
      }

      fetch()

      return () => {
        cancelled = true

        if (retryTimeout !== null) {
          clearTimeout(retryTimeout)
        }
      }
    },
    [pullRequest.id, pullRequest.state]
  )

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

  const mergeButtonLabel = getMergeButtonLabel(mergeOptions)
  const mergeReady = mergeOptions?.mergeable === true
  const showMerge = pullRequest.state === 'OPEN'

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

      {showMerge && (
        <>
          <Separator orientation="vertical" />

          <Button
            onClick={onOpenMergeDrawer}
            size="xs"
            variant={mergeReady ? 'default' : 'outline'}
          >
            {mergeOptions?.mergeable === null ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <GitMergeIcon className="size-3" />
            )}
            {mergeButtonLabel}
          </Button>
        </>
      )}
    </div>
  )
})

function getMergeButtonLabel(options: MergeOptions | null): string {
  if (!options) {
    return 'Merge'
  }

  if (options.mergeable === true) {
    return 'Ready to merge'
  }

  if (options.mergeable === null) {
    return 'Checking...'
  }

  switch (options.mergeableState) {
    case 'blocked':
      return 'Merge blocked'
    case 'dirty':
      return 'Has conflicts'
    case 'unstable':
      return 'Checks failing'
    default:
      return 'Cannot merge'
  }
}
