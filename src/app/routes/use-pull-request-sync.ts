import { useEffect } from 'react'

import {
  clearFocusedPullRequest,
  getMergeOptions,
  getPendingReview,
  markPullRequestActive,
  setFocusedPullRequest
} from '@/app/lib/api'
import { useAppDispatch } from '@/app/store/hooks'
import { mergeOptionsActions } from '@/app/store/merge-options-slice'
import { pendingReviewsActions } from '@/app/store/pending-reviews-slice'
import type { PullRequest } from '@/types/pull-request'

/** Tells the main process which pull request is open so it syncs it first. */
export function usePullRequestFocus(id: string | undefined): void {
  useEffect(
    function activatePullRequest() {
      if (id) {
        markPullRequestActive(id)
      }
    },
    [id]
  )

  useEffect(
    function focusPullRequest() {
      if (!id) {
        return
      }

      setFocusedPullRequest(id).catch(() => {
        // Best-effort focus signal; missing it just means slower refresh.
      })

      return () => {
        clearFocusedPullRequest().catch(() => {
          // Best-effort.
        })
      }
    },
    [id]
  )
}

/** Loads the viewer's pending review for the pull request into the store. */
export function usePendingReviewHydration(
  pullRequest: PullRequest | undefined
): void {
  const dispatch = useAppDispatch()

  useEffect(
    function hydratePendingReview() {
      if (!pullRequest) {
        return
      }

      let cancelled = false

      getPendingReview({
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        repo: pullRequest.repositoryName
      })
        .then((review) => {
          if (cancelled || !review) {
            return
          }

          dispatch(
            pendingReviewsActions.setReview({
              pullRequestId: pullRequest.id,
              review: {
                ...review,
                isCollapsed: false,
                pullRequestId: pullRequest.id
              }
            })
          )
        })
        .catch(() => {
          // Best-effort hydration; the focused sync will reconcile state.
        })

      return () => {
        cancelled = true
      }
    },
    [
      dispatch,
      pullRequest?.id,
      pullRequest?.number,
      pullRequest?.repositoryName,
      pullRequest?.repositoryOwner
    ]
  )
}

/**
 * Fetches merge options for an open pull request, retrying while GitHub is
 * still computing mergeability. Opening the merge drawer fetches them again.
 */
export function useMergeOptionsPolling(
  pullRequest: PullRequest | undefined,
  isMergeDrawerOpen: boolean
): void {
  const dispatch = useAppDispatch()

  useEffect(
    function fetchMergeOptions() {
      if (!pullRequest || pullRequest.state !== 'OPEN') {
        return
      }

      let cancelled = false
      let retryTimeout: ReturnType<typeof setTimeout> | null = null

      const fetch = () => {
        getMergeOptions(pullRequest.id)
          .then((options) => {
            if (cancelled) {
              return
            }

            dispatch(
              mergeOptionsActions.setForPullRequest({
                options,
                pullRequestId: pullRequest.id
              })
            )

            if (options.mergeable === null) {
              retryTimeout = setTimeout(fetch, 3000)
            }
          })
          .catch(() => {
            // Silently fail — merge button just won't appear.
          })
      }

      fetch()

      return () => {
        cancelled = true

        if (retryTimeout !== null) {
          clearTimeout(retryTimeout)
        }
      }
    },
    [dispatch, isMergeDrawerOpen, pullRequest?.id, pullRequest?.state]
  )
}
