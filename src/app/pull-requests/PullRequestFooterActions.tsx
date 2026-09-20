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
//
// The overflow menu leads the action group rather than sitting inside it. The
// bar is right-aligned, so the last element is in the window corner, and that
// position belongs to whatever the pull request needs next — merging it,
// approving it — not to the catch-all.
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

      <ActionSeparator />

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

      <CheckoutBranchButton pullRequest={pullRequest} />

      {review.pendingComments.length > 0 && (
        <span className="text-muted-foreground whitespace-nowrap">
          {review.pendingComments.length} pending{' '}
          {review.pendingComments.length === 1 ? 'comment' : 'comments'}
        </span>
      )}

      {canStartReview && (
        <>
          <ActionSeparator />

          <Button
            onClick={handleStartReview}
            size="xs"
          >
            Start review
          </Button>
        </>
      )}

      {/*
        Only a rule between two things. With the overflow menu moved to the
        front of the group, a closed pull request has nothing after this point
        and would otherwise end the bar on a dangling separator.
      */}
      {(review.hasPendingReview || canMerge) && <ActionSeparator />}

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

/**
 * A toolbar rule between two groups of actions.
 *
 * The shared `Separator` sizes a vertical rule with `h-full`, which resolves
 * against the flex row around it — and that row's height comes from its own
 * content, so the percentage has nothing to resolve against and the rule
 * collapses to zero. Both of the separator's stories work around this by
 * giving the row a fixed height; here the height is given to the rule
 * instead, so the buttons are still free to set the height of the bar.
 *
 * The override carries the same `data-[orientation=vertical]` prefix as the
 * rule it replaces. A bare `h-4` looks like it would win, but it is neither a
 * tailwind-merge conflict with the prefixed class nor specific enough to
 * outrank the attribute selector it compiles to, so `h-full` would survive.
 */
function ActionSeparator(): ReactElement {
  return (
    <Separator
      className="data-[orientation=vertical]:h-4"
      orientation="vertical"
    />
  )
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
