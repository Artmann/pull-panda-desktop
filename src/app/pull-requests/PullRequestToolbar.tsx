import { ChevronDown, ChevronUp, GitMergeIcon, Loader2 } from 'lucide-react'
import { memo, ReactElement, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { appFooterActionsSlotId } from '@/app/AppFooter'
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

function LandmarkNavigationButtons(): ReactElement {
  const navigation = usePullRequestNavigation()

  return (
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
  )
}

function ReviewSection({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement | null {
  const dispatch = useAppDispatch()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )

  const isDrawerCollapsed = pendingReview?.isCollapsed ?? false

  if (pendingReview) {
    return (
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
    )
  }

  if (pullRequest.isAuthor) {
    return null
  }

  return (
    <>
      <Separator orientation="vertical" />
      <div className="flex items-center gap-1">
        <Button
          onClick={() => {
            startPendingReview({ dispatch, pullRequest }).catch(() => {
              // startPendingReview surfaces its own error toast.
            })
          }}
          size="xs"
        >
          Start review
        </Button>
      </div>
    </>
  )
}

function MergeSection({
  onOpenMergeDrawer,
  pullRequest
}: PullRequestToolbarProps): ReactElement | null {
  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

  if (pullRequest.state !== 'OPEN') {
    return null
  }

  const mergeReady = mergeOptions?.mergeable === true

  return (
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
        {getMergeButtonLabel(mergeOptions)}
      </Button>
    </>
  )
}

export const PullRequestToolbar = memo(function PullRequestToolbar({
  onOpenMergeDrawer,
  pullRequest
}: PullRequestToolbarProps): ReactElement | null {
  // The footer renders the slot in the same commit as this page, so the
  // element exists by the time effects run.
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlot(document.getElementById(appFooterActionsSlotId))
  }, [])

  if (!slot) {
    return null
  }

  return createPortal(
    <div className="flex items-center gap-2 font-sans">
      <LandmarkNavigationButtons />

      <Separator orientation="vertical" />

      <CheckoutBranchButton pullRequest={pullRequest} />

      <ReviewSection pullRequest={pullRequest} />

      <MergeSection
        onOpenMergeDrawer={onOpenMergeDrawer}
        pullRequest={pullRequest}
      />
    </div>,
    slot
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
