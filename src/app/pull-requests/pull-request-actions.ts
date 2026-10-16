import { toast } from 'sonner'

import {
  dequeuePullRequest,
  disableAutoMerge,
  enableAutoMerge,
  enqueuePullRequest,
  getMergeOptions,
  updatePullRequest,
  updatePullRequestHidden,
  type MergeOptions
} from '@/app/lib/api'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import type { AppDispatch } from '@/app/store'
import { mergeOptionsActions } from '@/app/store/merge-options-slice'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { MergeMethod } from '@/types/merge-requirements'
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

interface SetHiddenParameters extends PullRequestActionParameters {
  hidden: boolean
}

// Hiding only takes the pull request out of the sidebar's default list. It is
// still found by search and listed in the Hidden view.
export function setPullRequestHidden({
  dispatch,
  hidden,
  pullRequest
}: SetHiddenParameters): void {
  const originalPullRequest = pullRequest

  runOptimisticMutation({
    optimistic: () =>
      dispatch(
        pullRequestsActions.upsertItem({
          ...pullRequest,
          hiddenAt: hidden ? new Date().toISOString() : null
        })
      ),
    request: () => updatePullRequestHidden(pullRequest.id, hidden),
    commit: (updated) => {
      dispatch(pullRequestsActions.upsertItem(updated))

      if (hidden) {
        toast.success('Pull request hidden.', {
          action: {
            label: 'Undo',
            onClick: () =>
              setPullRequestHidden({
                dispatch,
                hidden: false,
                pullRequest: updated
              })
          }
        })
      }
    },
    rollback: () =>
      dispatch(pullRequestsActions.upsertItem(originalPullRequest)),
    errorMessage: hidden
      ? 'Could not hide the pull request.'
      : 'Could not unhide the pull request.'
  })
}

interface MergeAutomationParameters {
  dispatch: AppDispatch
  mergeOptions: MergeOptions
  pullRequestId: string
}

interface MergeOptionsMutation extends MergeAutomationParameters {
  errorMessage: string
  optimisticOptions: MergeOptions
  request: () => Promise<MergeOptions>
}

// The auto-merge and merge queue actions only change merge options, and each
// request answers with the fresh options, so they share one optimistic flow.
function runMergeOptionsMutation({
  dispatch,
  errorMessage,
  mergeOptions,
  optimisticOptions,
  pullRequestId,
  request
}: MergeOptionsMutation): void {
  const setOptions = (options: MergeOptions) =>
    dispatch(mergeOptionsActions.setForPullRequest({ options, pullRequestId }))

  runOptimisticMutation({
    optimistic: () => setOptions(optimisticOptions),
    request,
    commit: setOptions,
    rollback: () => setOptions(mergeOptions),
    errorMessage
  })
}

interface EnableAutoMergeParameters extends MergeAutomationParameters {
  commitBody?: string
  commitHeadline?: string
  /** Leave out when the base branch uses a merge queue. */
  mergeMethod?: MergeMethod
}

export function enablePullRequestAutoMerge({
  commitBody,
  commitHeadline,
  dispatch,
  mergeMethod,
  mergeOptions,
  pullRequestId
}: EnableAutoMergeParameters): void {
  runMergeOptionsMutation({
    dispatch,
    errorMessage: 'Failed to enable auto-merge',
    mergeOptions,
    optimisticOptions: {
      ...mergeOptions,
      autoMergeRequest: {
        enabledAt: new Date().toISOString(),
        enabledByLogin: null,
        mergeMethod: mergeMethod ?? null
      },
      viewerCanDisableAutoMerge: true,
      viewerCanEnableAutoMerge: false
    },
    pullRequestId,
    request: () =>
      enableAutoMerge({
        commitBody,
        commitHeadline,
        mergeMethod,
        pullRequestId
      })
  })
}

export function disablePullRequestAutoMerge({
  dispatch,
  mergeOptions,
  pullRequestId
}: MergeAutomationParameters): void {
  runMergeOptionsMutation({
    dispatch,
    errorMessage: 'Failed to disable auto-merge',
    mergeOptions,
    optimisticOptions: {
      ...mergeOptions,
      autoMergeRequest: null,
      viewerCanDisableAutoMerge: false,
      viewerCanEnableAutoMerge: true
    },
    pullRequestId,
    request: () => disableAutoMerge(pullRequestId)
  })
}

export function addPullRequestToMergeQueue({
  dispatch,
  mergeOptions,
  pullRequestId
}: MergeAutomationParameters): void {
  runMergeOptionsMutation({
    dispatch,
    errorMessage: 'Failed to add the pull request to the merge queue',
    mergeOptions,
    optimisticOptions: {
      ...mergeOptions,
      mergeQueueEntry: {
        enqueuedAt: new Date().toISOString(),
        estimatedTimeToMerge: null,
        position: null,
        state: 'QUEUED'
      }
    },
    pullRequestId,
    request: () => enqueuePullRequest(pullRequestId)
  })
}

// Leaving the queue also cancels "merge when ready", so both are cleared.
export function removePullRequestFromMergeQueue({
  dispatch,
  mergeOptions,
  pullRequestId
}: MergeAutomationParameters): void {
  runMergeOptionsMutation({
    dispatch,
    errorMessage: 'Failed to remove the pull request from the merge queue',
    mergeOptions,
    optimisticOptions: {
      ...mergeOptions,
      autoMergeRequest: null,
      mergeQueueEntry: null
    },
    pullRequestId,
    request: () => dequeuePullRequest(pullRequestId)
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
