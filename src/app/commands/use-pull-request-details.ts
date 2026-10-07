import { useMemo } from 'react'
import { shallowEqual } from 'react-redux'

import type { RootState } from '@/app/store'
import { useAppSelector } from '@/app/store/hooks'
import type { PullRequestDetails } from '@/types/pull-request-details'

function usePullRequestItems<Item extends { pullRequestId: string }>(
  pullRequestId: string | undefined,
  selectItems: (state: RootState) => Item[]
): Item[] {
  return useAppSelector(
    (state) =>
      pullRequestId
        ? selectItems(state).filter(
            (item) => item.pullRequestId === pullRequestId
          )
        : [],
    shallowEqual
  )
}

export function usePullRequestDetails(
  pullRequestId: string | undefined
): PullRequestDetails | undefined {
  const checks = usePullRequestItems(
    pullRequestId,
    (state) => state.checks.items
  )
  const comments = usePullRequestItems(
    pullRequestId,
    (state) => state.comments.items
  )
  const commits = usePullRequestItems(
    pullRequestId,
    (state) => state.commits.items
  )
  const files = usePullRequestItems(
    pullRequestId,
    (state) => state.modifiedFiles.items
  )
  const reactions = usePullRequestItems(
    pullRequestId,
    (state) => state.reactions.items
  )
  const reviews = usePullRequestItems(
    pullRequestId,
    (state) => state.reviews.items
  )
  const reviewThreads = usePullRequestItems(
    pullRequestId,
    (state) => state.reviewThreads.items
  )

  return useMemo(
    () =>
      pullRequestId
        ? {
            checks,
            comments,
            commits,
            files,
            reactions,
            reviews,
            reviewThreads
          }
        : undefined,
    [
      pullRequestId,
      checks,
      comments,
      commits,
      files,
      reactions,
      reviews,
      reviewThreads
    ]
  )
}
