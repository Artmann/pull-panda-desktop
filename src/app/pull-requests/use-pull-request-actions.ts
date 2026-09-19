import { useMemo } from 'react'

import {
  canCopyBranchName,
  closePullRequest,
  copyPullRequestBranchName,
  copyPullRequestLink,
  openPullRequestOnGitHub,
  reopenPullRequest,
  togglePullRequestDraft
} from '@/app/pull-requests/pull-request-actions'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'

export interface PullRequestActionDescriptor {
  group: 'links' | 'state'
  id: string
  isDestructive?: boolean
  label: string
  run: () => void
}

// The pull request actions that belong in an overflow menu: changing the pull
// request's own state, and the link actions. Returned as descriptors so the
// menu stays a renderer and the availability rules live in one place.
export function usePullRequestActions(
  pullRequest: PullRequest
): PullRequestActionDescriptor[] {
  const dispatch = useAppDispatch()

  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

  return useMemo(() => {
    const actions: PullRequestActionDescriptor[] = []

    if (pullRequest.state === 'OPEN') {
      actions.push({
        group: 'state',
        id: 'toggle-draft',
        label: pullRequest.isDraft
          ? 'Mark as ready for review'
          : 'Mark as draft',
        run: () =>
          togglePullRequestDraft({ dispatch, mergeOptions, pullRequest })
      })

      actions.push({
        group: 'state',
        id: 'close',
        isDestructive: true,
        label: 'Close pull request',
        run: () => closePullRequest({ dispatch, pullRequest })
      })
    }

    if (pullRequest.state === 'CLOSED') {
      actions.push({
        group: 'state',
        id: 'reopen',
        label: 'Reopen pull request',
        run: () => reopenPullRequest({ dispatch, pullRequest })
      })
    }

    actions.push({
      group: 'links',
      id: 'open-in-github',
      label: 'Open on GitHub',
      run: () => openPullRequestOnGitHub(pullRequest)
    })

    actions.push({
      group: 'links',
      id: 'copy-link',
      label: 'Copy link',
      run: () => copyPullRequestLink(pullRequest)
    })

    if (canCopyBranchName(pullRequest)) {
      actions.push({
        group: 'links',
        id: 'copy-branch',
        label: 'Copy branch name',
        run: () => copyPullRequestBranchName(pullRequest)
      })
    }

    return actions
  }, [dispatch, mergeOptions, pullRequest])
}
