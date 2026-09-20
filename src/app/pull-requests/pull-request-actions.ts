import { toast } from 'sonner'

import {
  getMergeOptions,
  updatePullRequest,
  type MergeOptions
} from '@/app/lib/api'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import type { AppDispatch } from '@/app/store'
import { mergeOptionsActions } from '@/app/store/merge-options-slice'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { PullRequest } from '@/types/pull-request'

// The single implementation of each pull request action, kept free of React so
// the footer bar, the command registry and any menu can share it rather than
// growing their own copy. Every mutating action goes through
// `runOptimisticMutation`, so each one updates the store synchronously and
// rolls back with a toast on failure.

interface PullRequestActionParameters {
  dispatch: AppDispatch
  pullRequest: PullRequest
}

export function closePullRequest({
  dispatch,
  pullRequest
}: PullRequestActionParameters): void {
  const originalPullRequest = pullRequest

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
    rollback: () =>
      dispatch(pullRequestsActions.upsertItem(originalPullRequest)),
    errorMessage: 'Failed to close pull request'
  })
}

export function reopenPullRequest({
  dispatch,
  pullRequest
}: PullRequestActionParameters): void {
  const originalPullRequest = pullRequest

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
    rollback: () =>
      dispatch(pullRequestsActions.upsertItem(originalPullRequest)),
    errorMessage: 'Failed to reopen pull request'
  })
}

interface ToggleDraftParameters extends PullRequestActionParameters {
  mergeOptions: MergeOptions | null
}

export function togglePullRequestDraft({
  dispatch,
  mergeOptions,
  pullRequest
}: ToggleDraftParameters): void {
  const originalPullRequest = pullRequest
  const originalMergeOptions = mergeOptions
  const nextIsDraft = !pullRequest.isDraft

  runOptimisticMutation({
    optimistic: () => {
      dispatch(
        pullRequestsActions.upsertItem({ ...pullRequest, isDraft: nextIsDraft })
      )

      const optimisticMergeOptions = buildOptimisticMergeOptions(
        mergeOptions,
        nextIsDraft
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
        isDraft: nextIsDraft,
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
      dispatch(pullRequestsActions.upsertItem(originalPullRequest))

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

export function openPullRequestOnGitHub(pullRequest: PullRequest): void {
  window.electron.openUrl(pullRequest.url).catch(() => {
    toast.error('Failed to open pull request in your browser')
  })
}

export function copyPullRequestLink(pullRequest: PullRequest): void {
  copyToClipboard(
    pullRequest.url,
    'Link copied to clipboard',
    'Failed to copy link'
  )
}

export function copyPullRequestBranchName(pullRequest: PullRequest): void {
  // `headRefName` is null until the pull request has been synced in full, which
  // is why callers must gate this on `canCopyBranchName`.
  if (pullRequest.headRefName === null) {
    return
  }

  copyToClipboard(
    pullRequest.headRefName,
    'Branch name copied to clipboard',
    'Failed to copy branch name'
  )
}

export function canCopyBranchName(pullRequest: PullRequest): boolean {
  return pullRequest.headRefName !== null
}

function copyToClipboard(
  value: string,
  successMessage: string,
  errorMessage: string
): void {
  navigator.clipboard
    .writeText(value)
    .then(() => {
      toast.success(successMessage)
    })
    .catch(() => {
      toast.error(errorMessage)
    })
}

function buildOptimisticMergeOptions(
  options: MergeOptions | null,
  nextIsDraft: boolean
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
    description: nextIsDraft
      ? 'This pull request is still a draft.'
      : 'Pull request is ready for review.',
    satisfied: !nextIsDraft
  }

  return {
    ...options,
    requirements: nextRequirements
  }
}
