import {
  Check,
  CheckCircle,
  CircleCheck,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle
} from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { approvePullRequest } from '@/app/lib/api'
import { useAuth } from '@/app/lib/store/authContext'
import { cn } from '@/app/lib/utils'
import { hasLatestApprovalFromUser } from '@/app/pull-requests/get-latest-reviews'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  pendingReviewCommentsActions,
  type PendingReviewComment
} from '@/app/store/pending-review-comments-slice'
import {
  pendingReviewsActions,
  type PendingReview
} from '@/app/store/pending-reviews-slice'
import { PullRequest } from '@/types/pull-request'

import { PullRequestStatusBadge } from './PullRequestStatusBadge'
import { TimeAgo } from './TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { TableCell, TableRow } from './ui/table'

const emptyPendingComments: PendingReviewComment[] = []

interface PullRequestTableRowProps {
  pullRequest: PullRequest
  showActions?: boolean
}

export function PullRequestTableRow({
  pullRequest,
  showActions = false
}: PullRequestTableRowProps): ReactElement {
  const navigate = useNavigate()

  const pullRequestPath = `/pull-requests/${pullRequest.id}`

  const handleClick = () => {
    navigate(pullRequestPath)
  }

  const repoSlug = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}#${pullRequest.number}`

  return (
    <TableRow
      className="cursor-pointer"
      onClick={handleClick}
    >
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="truncate max-w-md">{pullRequest.title}</span>

          <span className="text-xs text-muted-foreground">{repoSlug}</span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage
              alt={pullRequest.authorLogin ?? 'Author'}
              src={pullRequest.authorAvatarUrl ?? undefined}
            />

            <AvatarFallback className="text-xs">
              {pullRequest.authorLogin?.charAt(0).toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>

          <span className="text-sm">
            {pullRequest.authorLogin ?? 'Unknown'}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <PullRequestStatusBadge pullRequest={pullRequest} />
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-3" />
            <span className="text-sm">{pullRequest.commentCount}</span>
          </div>

          <div className="flex items-center gap-1">
            <CheckCircle className="size-3" />
            <span className="text-sm">{pullRequest.approvalCount}</span>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <span className="text-sm text-muted-foreground">
          <TimeAgo dateTime={pullRequest.updatedAt} />
        </span>
      </TableCell>

      {showActions ? (
        <TableCell
          className="w-[1%] whitespace-nowrap"
          onClick={(event) => event.stopPropagation()}
        >
          <PullRequestTableActionsCell pullRequest={pullRequest} />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function PullRequestTableActionsCell({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const { user } = useAuth()
  const dispatch = useAppDispatch()
  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )
  const pendingComments = useAppSelector(
    (state) =>
      state.pendingReviewComments[pullRequest.id] ?? emptyPendingComments
  )
  const userLogin = user?.login ?? ''

  const hasMyApproval = useAppSelector((state) =>
    userLogin
      ? hasLatestApprovalFromUser(
          state.reviews.items,
          pullRequest.id,
          userLogin
        )
      : false
  )

  const [isApproving, setIsApproving] = useState(false)

  const iconClassName = 'size-4 text-muted-foreground'

  const approveIconClassName = cn(
    'size-4',
    hasMyApproval ? 'text-status-success-foreground' : 'text-muted-foreground'
  )

  const handleApprove = () => {
    if (isApproving) {
      return
    }

    const existingId =
      pendingReview?.gitHubNumericId && pendingReview.gitHubNumericId > 0
        ? pendingReview.gitHubNumericId
        : null

    const previousReview: PendingReview | undefined = pendingReview
      ? { ...pendingReview }
      : undefined
    const previousComments: PendingReviewComment[] = [...pendingComments]

    setIsApproving(true)

    dispatch(
      pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
    )
    dispatch(
      pendingReviewCommentsActions.clearComments({
        pullRequestId: pullRequest.id
      })
    )

    approvePullRequest(pullRequest, existingId)
      .then(() => {
        toast.success('Approved the pull request')
      })
      .catch((error: unknown) => {
        if (previousReview) {
          dispatch(
            pendingReviewsActions.setReview({
              pullRequestId: pullRequest.id,
              review: previousReview
            })
          )
        }

        for (const comment of previousComments) {
          dispatch(
            pendingReviewCommentsActions.addComment({
              pullRequestId: pullRequest.id,
              comment
            })
          )
        }

        const message =
          error instanceof Error ? error.message : 'Failed to approve'

        toast.error(message)
      })
      .finally(() => {
        setIsApproving(false)
      })
  }

  const handleCopyUrl = () => {
    navigator.clipboard
      .writeText(pullRequest.url)
      .then(() => {
        toast.success('Copied pull request link')
      })
      .catch(() => {
        toast.error('Could not copy link')
      })
  }

  const handleOpenInBrowser = () => {
    window.electron.openUrl(pullRequest.url).catch(() => {
      toast.error('Could not open link')
    })
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        aria-label={
          hasMyApproval
            ? 'You approved this pull request'
            : 'Approve pull request'
        }
        disabled={isApproving || hasMyApproval}
        onClick={handleApprove}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        {isApproving ? (
          <Loader2
            aria-hidden
            className="size-3 animate-spin"
          />
        ) : hasMyApproval ? (
          <Check
            aria-hidden
            className={approveIconClassName}
            strokeWidth={3}
          />
        ) : (
          <CircleCheck
            aria-hidden
            className={approveIconClassName}
          />
        )}
      </Button>

      <Button
        aria-label="Copy pull request URL"
        className="text-muted-foreground"
        onClick={handleCopyUrl}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Copy
          aria-hidden
          className={iconClassName}
        />
      </Button>

      <Button
        aria-label="Open pull request in browser"
        className="text-muted-foreground"
        onClick={handleOpenInBrowser}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ExternalLink
          aria-hidden
          className={iconClassName}
        />
      </Button>
    </div>
  )
}
