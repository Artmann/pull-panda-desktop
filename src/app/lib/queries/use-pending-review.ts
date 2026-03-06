import { useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../query-keys'

export interface PendingReview {
  authorAvatarUrl: string | null
  authorLogin: string | null
  body: string | null
  gitHubId: string
  gitHubNumericId: number | null
  id: string
  pullRequestId: string
  state: string
}

export function usePendingReview(
  pullRequestId: string
): PendingReview | undefined {
  const { data } = useQuery<PendingReview | null>({
    queryKey: queryKeys.pendingReviews.byPullRequest(pullRequestId),
    queryFn: () => null
  })

  return data ?? undefined
}

export function useSetPendingReview() {
  const queryClient = useQueryClient()

  return (pullRequestId: string, review: PendingReview) => {
    queryClient.setQueryData(
      queryKeys.pendingReviews.byPullRequest(pullRequestId),
      review
    )
  }
}

export function useClearPendingReview() {
  const queryClient = useQueryClient()

  return (pullRequestId: string) => {
    queryClient.setQueryData(
      queryKeys.pendingReviews.byPullRequest(pullRequestId),
      null
    )
  }
}

export function createOptimisticReview(pullRequestId: string): PendingReview {
  const tempId = `temp-${crypto.randomUUID()}`

  return {
    authorAvatarUrl: null,
    authorLogin: null,
    body: null,
    gitHubId: tempId,
    gitHubNumericId: 0,
    id: tempId,
    pullRequestId,
    state: 'PENDING'
  }
}
