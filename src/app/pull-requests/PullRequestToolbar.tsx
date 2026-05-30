import { ChevronDown, ChevronUp, GitMergeIcon, Loader2 } from 'lucide-react'
import { memo, ReactElement } from 'react'

import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import type { MergeOptions } from '@/app/lib/api'
import { CheckoutBranchButton } from '@/app/pull-requests/components/CheckoutBranchButton'
import { usePullRequestNavigation } from '@/app/pull-requests/PullRequestNavigationProvider'
import { startPendingReview } from '@/app/pull-requests/start-pending-review'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pendingReviewsActions } from '@/app/store/pending-reviews-slice'
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
  const navigation = usePullRequestNavigation()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )

  const hasPendingReview = Boolean(pendingReview)
  const isDrawerCollapsed = pendingReview?.isCollapsed ?? false

  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

  const handleStartReview = async () => {
    if (hasPendingReview) {
      return
    }

    await startPendingReview({ dispatch, pullRequest })
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
          onClick={() => navigation.jumpToPreviousLandmark()}
          size="icon-xs"
          title="Previous landmark (k)"
          variant="outline"
        >
          <ChevronUp className="size-3" />
        </Button>

        <Button
          onClick={() => navigation.jumpToNextLandmark()}
          size="icon-xs"
          title="Next landmark (j)"
          variant="outline"
        >
          <ChevronDown className="size-3" />
        </Button>
      </div>

      <Separator orientation="vertical" />

      <CheckoutBranchButton pullRequest={pullRequest} />

      {hasPendingReview ? (
        <>
          <Separator orientation="vertical" />
          <div className="flex items-center gap-1">
            <Button
              onClick={() =>
                dispatch(
                  pendingReviewsActions.setCollapsed({
                    collapsed: !isDrawerCollapsed,
                    pullRequestId: pullRequest.id
                  })
                )
              }
              size="xs"
              variant="outline"
            >
              {isDrawerCollapsed ? 'Resume review' : 'Review in progress'}
            </Button>
          </div>
        </>
      ) : !pullRequest.isAuthor ? (
        <>
          <Separator orientation="vertical" />
          <div className="flex items-center gap-1">
            <Button
              onClick={handleStartReview}
              size="xs"
            >
              Start review
            </Button>
          </div>
        </>
      ) : null}

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
