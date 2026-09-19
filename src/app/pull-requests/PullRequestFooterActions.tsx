import {
  ChevronDown,
  ChevronUp,
  GitMergeIcon,
  Loader2,
  MoreHorizontalIcon
} from 'lucide-react'
import { Fragment, type ReactElement, type ReactNode } from 'react'

import type { MergeOptions } from '@/app/lib/api'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu'
import { Separator } from '@/app/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
import { Kbd } from '@/app/components/Kbd'
import { CheckoutBranchButton } from '@/app/pull-requests/components/CheckoutBranchButton'
import { getMergeButtonLabel } from '@/app/pull-requests/merge-button-label'
import { usePullRequestNavigation } from '@/app/pull-requests/PullRequestNavigationProvider'
import { startPendingReview } from '@/app/pull-requests/start-pending-review'
import {
  usePendingReviewActions,
  type PendingReviewActions
} from '@/app/pull-requests/use-pending-review-actions'
import {
  usePullRequestActions,
  type PullRequestActionDescriptor
} from '@/app/pull-requests/use-pull-request-actions'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { mergeDrawerActions } from '@/app/store/merge-drawer-slice'
import type { PullRequest } from '@/types/pull-request'

interface PullRequestFooterActionsProps {
  pullRequest: PullRequest
}

// The pull request actions, hosted in AppFooter. There are more actions than
// fit on one row, so the bar is state driven: landmark navigation and checkout
// are always present, the primary control on the right follows what the pull
// request needs next, and everything low-frequency lives behind the overflow
// menu.
export function PullRequestFooterActions({
  pullRequest
}: PullRequestFooterActionsProps): ReactElement {
  const dispatch = useAppDispatch()
  const overflowActions = usePullRequestActions(pullRequest)
  const review = usePendingReviewActions(pullRequest)

  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

  const canMerge = pullRequest.state === 'OPEN'
  const canStartReview = !review.hasPendingReview && !pullRequest.isAuthor

  const openMergeDrawer = () => {
    dispatch(mergeDrawerActions.open({ pullRequestId: pullRequest.id }))
  }

  const handleStartReview = () => {
    startPendingReview({ dispatch, pullRequest }).catch(() => {
      // startPendingReview already rolls the store back and shows a toast.
    })
  }

  return (
    <div className="flex items-center gap-2">
      <LandmarkNavigation />

      <Separator orientation="vertical" />

      <CheckoutBranchButton pullRequest={pullRequest} />

      {review.pendingComments.length > 0 && (
        <span className="text-muted-foreground whitespace-nowrap">
          {review.pendingComments.length} pending{' '}
          {review.pendingComments.length === 1 ? 'comment' : 'comments'}
        </span>
      )}

      {canStartReview && (
        <>
          <Separator orientation="vertical" />

          <Button
            onClick={handleStartReview}
            size="xs"
          >
            Start review
          </Button>
        </>
      )}

      <Separator orientation="vertical" />

      <OverflowMenu
        actions={[
          ...buildReviewOverflowActions({
            canMerge,
            mergeOptions,
            onOpenMergeDrawer: openMergeDrawer,
            review
          }),
          ...overflowActions
        ]}
      />

      {review.hasPendingReview && <ReviewSubmitActions review={review} />}

      {!review.hasPendingReview && canMerge && (
        <MergeButton
          mergeOptions={mergeOptions}
          onOpenMergeDrawer={openMergeDrawer}
        />
      )}
    </div>
  )
}

interface ReviewOverflowParameters {
  canMerge: boolean
  mergeOptions: MergeOptions | null
  onOpenMergeDrawer: () => void
  review: PendingReviewActions
}

// While a review is open, cancelling it and merging both step out of the way to
// make room for the three submit buttons.
function buildReviewOverflowActions({
  canMerge,
  mergeOptions,
  onOpenMergeDrawer,
  review
}: ReviewOverflowParameters): PullRequestActionDescriptor[] {
  if (!review.hasPendingReview) {
    return []
  }

  const actions: PullRequestActionDescriptor[] = [
    {
      group: 'state',
      id: 'cancel-review',
      isDestructive: true,
      label: 'Cancel review',
      run: review.cancelReview
    }
  ]

  if (canMerge) {
    actions.push({
      group: 'state',
      id: 'merge',
      label: getMergeButtonLabel(mergeOptions),
      run: onOpenMergeDrawer
    })
  }

  return actions
}

function LandmarkNavigation(): ReactElement {
  const navigation = usePullRequestNavigation()

  return (
    <div className="flex items-center gap-1">
      <LandmarkButton
        hotkey="K"
        label="Previous section"
        onClick={() => navigation.jumpToPreviousLandmark()}
      >
        <ChevronUp className="size-3" />
      </LandmarkButton>

      <LandmarkButton
        hotkey="J"
        label="Next section"
        onClick={() => navigation.jumpToNextLandmark()}
      >
        <ChevronDown className="size-3" />
      </LandmarkButton>
    </div>
  )
}

/**
 * The chevrons move between the sections of the open pull request — the
 * description, each file, each comment thread — not between pull requests,
 * which is shift+J and shift+K and has no buttons. "Landmark" is what the
 * navigation API calls them; the reader gets told "section".
 */
function LandmarkButton({
  children,
  hotkey,
  label,
  onClick
}: {
  children: ReactNode
  hotkey: string
  label: string
  onClick: () => void
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          onClick={onClick}
          size="icon-xs"
          variant="outline"
        >
          {children}
        </Button>
      </TooltipTrigger>

      <TooltipContent className="flex items-center gap-2">
        {label}

        <Kbd className="border-background/40 text-background">{hotkey}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

interface ReviewSubmitActionsProps {
  review: PendingReviewActions
}

function ReviewSubmitActions({
  review
}: ReviewSubmitActionsProps): ReactElement {
  const isBlocked = review.isSubmitting || !review.hasReviewContent

  return (
    <>
      <Button
        disabled={isBlocked}
        onClick={() => review.submitReview('COMMENT')}
        size="xs"
        variant="outline"
      >
        Comment
      </Button>

      <Button
        disabled={isBlocked}
        onClick={() => review.submitReview('REQUEST_CHANGES')}
        size="xs"
        variant="outline"
      >
        Request changes
      </Button>

      <Button
        disabled={review.isSubmitting}
        onClick={() => review.submitReview('APPROVE')}
        size="xs"
      >
        Approve
      </Button>
    </>
  )
}

interface MergeButtonProps {
  mergeOptions: MergeOptions | null
  onOpenMergeDrawer: () => void
}

function MergeButton({
  mergeOptions,
  onOpenMergeDrawer
}: MergeButtonProps): ReactElement {
  const button = (
    <Button
      onClick={onOpenMergeDrawer}
      size="xs"
      variant={mergeOptions?.mergeable === true ? 'default' : 'outline'}
    >
      {mergeOptions?.mergeable === null ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <GitMergeIcon className="size-3" />
      )}
      {getMergeButtonLabel(mergeOptions)}
    </Button>
  )

  const blockers = (mergeOptions?.requirements ?? []).filter(
    (requirement) => !requirement.satisfied
  )

  // The label already says *that* the merge is blocked; the tooltip is where
  // it says what by, so there is nothing to add when nothing blocks it.
  if (blockers.length === 0) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>

      <TooltipContent className="max-w-64">
        <ul className="space-y-1">
          {blockers.map((requirement) => (
            <li key={requirement.key}>{requirement.description}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

interface OverflowMenuProps {
  actions: PullRequestActionDescriptor[]
}

function OverflowMenu({ actions }: OverflowMenuProps): ReactElement {
  const groups = groupByGroup(actions)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="More actions"
          size="icon-xs"
          title="More actions"
          variant="outline"
        >
          <MoreHorizontalIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {groups.map((group, index) => (
          <Fragment key={group[0].id}>
            {index > 0 && <DropdownMenuSeparator />}

            {group.map((action) => (
              <DropdownMenuItem
                className={
                  action.isDestructive
                    ? 'text-destructive focus:text-destructive'
                    : undefined
                }
                key={action.id}
                onSelect={action.run}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function groupByGroup(
  actions: PullRequestActionDescriptor[]
): PullRequestActionDescriptor[][] {
  const state = actions.filter((action) => action.group === 'state')
  const links = actions.filter((action) => action.group === 'links')

  return [state, links].filter((group) => group.length > 0)
}
