import { MoreVerticalIcon } from 'lucide-react'
import { ReactElement } from 'react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu'
import { updatePullRequest } from '@/app/lib/api'
import { useAppDispatch } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { PullRequest } from '@/types/pull-request'

interface PullRequestActionsMenuProps {
  pullRequest: PullRequest
}

export function PullRequestActionsMenu({
  pullRequest
}: PullRequestActionsMenuProps): ReactElement {
  const dispatch = useAppDispatch()

  const handleClose = () => {
    const originalPr = pullRequest

    dispatch(
      pullRequestsActions.upsertItem({ ...pullRequest, state: 'CLOSED' })
    )

    updatePullRequest({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName,
      state: 'closed'
    })
      .then((updated) => {
        dispatch(pullRequestsActions.upsertItem(updated))
      })
      .catch((error) => {
        dispatch(pullRequestsActions.upsertItem(originalPr))

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to close pull request'

        toast.error(message)
      })
  }

  const handleReopen = () => {
    const originalPr = pullRequest

    dispatch(pullRequestsActions.upsertItem({ ...pullRequest, state: 'OPEN' }))

    updatePullRequest({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName,
      state: 'open'
    })
      .then((updated) => {
        dispatch(pullRequestsActions.upsertItem(updated))
      })
      .catch((error) => {
        dispatch(pullRequestsActions.upsertItem(originalPr))

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to reopen pull request'

        toast.error(message)
      })
  }

  const handleToggleDraft = () => {
    const originalPr = pullRequest
    const newIsDraft = !pullRequest.isDraft

    dispatch(
      pullRequestsActions.upsertItem({ ...pullRequest, isDraft: newIsDraft })
    )

    void updatePullRequest({
      isDraft: newIsDraft,
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName
    })
      .then((updated) => {
        dispatch(pullRequestsActions.upsertItem(updated))
      })
      .catch((error) => {
        dispatch(pullRequestsActions.upsertItem(originalPr))

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to update draft status'

        toast.error(message)
      })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="More actions"
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="More actions"
        >
          <MoreVerticalIcon className="size-3" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {pullRequest.state === 'OPEN' && (
          <>
            <DropdownMenuItem onSelect={handleToggleDraft}>
              {pullRequest.isDraft
                ? 'Mark as ready for review'
                : 'Mark as draft'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={handleClose}
            >
              Close pull request
            </DropdownMenuItem>
          </>
        )}

        {pullRequest.state === 'CLOSED' && (
          <DropdownMenuItem onSelect={handleReopen}>
            Reopen pull request
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
