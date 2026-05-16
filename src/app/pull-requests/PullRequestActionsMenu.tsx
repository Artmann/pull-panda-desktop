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
import {
  getMergeOptions,
  updatePullRequest,
  type MergeOptions
} from '@/app/lib/api'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { mergeOptionsActions } from '@/app/store/merge-options-slice'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { PullRequest } from '@/types/pull-request'

interface PullRequestActionsMenuProps {
  pullRequest: PullRequest
}

export function PullRequestActionsMenu({
  pullRequest
}: PullRequestActionsMenuProps): ReactElement {
  const dispatch = useAppDispatch()

  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

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
    const originalMergeOptions = mergeOptions
    const newIsDraft = !pullRequest.isDraft

    dispatch(
      pullRequestsActions.upsertItem({ ...pullRequest, isDraft: newIsDraft })
    )

    const optimisticMergeOptions = buildOptimisticMergeOptions(
      mergeOptions,
      newIsDraft
    )

    if (optimisticMergeOptions) {
      dispatch(
        mergeOptionsActions.setForPullRequest({
          options: optimisticMergeOptions,
          pullRequestId: pullRequest.id
        })
      )
    }

    updatePullRequest({
      isDraft: newIsDraft,
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName
    })
      .then((updated) => {
        dispatch(pullRequestsActions.upsertItem(updated))

        getMergeOptions(pullRequest.id)
          .then((options) => {
            dispatch(
              mergeOptionsActions.setForPullRequest({
                options,
                pullRequestId: pullRequest.id
              })
            )
          })
          .catch(() => {
            // The optimistic update already reflects the new draft state;
            // the next page mount or merge-drawer open will reconcile.
          })
      })
      .catch((error) => {
        dispatch(pullRequestsActions.upsertItem(originalPr))

        if (originalMergeOptions) {
          dispatch(
            mergeOptionsActions.setForPullRequest({
              options: originalMergeOptions,
              pullRequestId: pullRequest.id
            })
          )
        }

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

function buildOptimisticMergeOptions(
  options: MergeOptions | null,
  newIsDraft: boolean
): MergeOptions | null {
  if (!options) {
    return null
  }

  const index = options.requirements.findIndex(
    (requirement) => requirement.key === 'not-draft'
  )

  if (index === -1) {
    return null
  }

  const nextRequirements = options.requirements.slice()

  nextRequirements[index] = {
    ...nextRequirements[index],
    description: newIsDraft
      ? 'This pull request is still a draft.'
      : 'Pull request is ready for review.',
    satisfied: !newIsDraft
  }

  return {
    ...options,
    requirements: nextRequirements
  }
}
