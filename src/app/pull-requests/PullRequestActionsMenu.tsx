import { MoreVerticalIcon } from 'lucide-react'
import { ReactElement } from 'react'

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
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
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

    runOptimisticMutation({
      optimistic: () =>
        dispatch(
          pullRequestsActions.upsertItem({ ...pullRequest, state: 'CLOSED' })
        ),
      request: () =>
        updatePullRequest({
          owner: pullRequest.repositoryOwner,
          pullNumber: pullRequest.number,
          pullRequestId: pullRequest.id,
          repo: pullRequest.repositoryName,
          state: 'closed'
        }),
      commit: (updated) => dispatch(pullRequestsActions.upsertItem(updated)),
      rollback: () => dispatch(pullRequestsActions.upsertItem(originalPr)),
      errorMessage: 'Failed to close pull request'
    })
  }

  const handleReopen = () => {
    const originalPr = pullRequest

    runOptimisticMutation({
      optimistic: () =>
        dispatch(
          pullRequestsActions.upsertItem({ ...pullRequest, state: 'OPEN' })
        ),
      request: () =>
        updatePullRequest({
          owner: pullRequest.repositoryOwner,
          pullNumber: pullRequest.number,
          pullRequestId: pullRequest.id,
          repo: pullRequest.repositoryName,
          state: 'open'
        }),
      commit: (updated) => dispatch(pullRequestsActions.upsertItem(updated)),
      rollback: () => dispatch(pullRequestsActions.upsertItem(originalPr)),
      errorMessage: 'Failed to reopen pull request'
    })
  }

  const handleToggleDraft = () => {
    const originalPr = pullRequest
    const originalMergeOptions = mergeOptions
    const newIsDraft = !pullRequest.isDraft

    runOptimisticMutation({
      optimistic: () => {
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
      },
      request: () =>
        updatePullRequest({
          isDraft: newIsDraft,
          owner: pullRequest.repositoryOwner,
          pullNumber: pullRequest.number,
          pullRequestId: pullRequest.id,
          repo: pullRequest.repositoryName
        }),
      commit: (updated) => {
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
      },
      rollback: () => {
        dispatch(pullRequestsActions.upsertItem(originalPr))

        if (originalMergeOptions) {
          dispatch(
            mergeOptionsActions.setForPullRequest({
              options: originalMergeOptions,
              pullRequestId: pullRequest.id
            })
          )
        }
      },
      errorMessage: 'Failed to update draft status'
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
