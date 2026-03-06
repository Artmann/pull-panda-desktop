import { useQuery } from '@tanstack/react-query'

import type { Review } from '@/types/pull-request-details'

import { queryKeys } from '../query-keys'

export function useReviews(pullRequestId: string): Review[] {
  const { data } = useQuery<Review[]>({
    queryKey: queryKeys.reviews.byPullRequest(pullRequestId),
    queryFn: () => []
  })

  return data ?? []
}
