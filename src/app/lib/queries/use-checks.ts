import { useQuery } from '@tanstack/react-query'

import type { Check } from '@/types/pull-request-details'

import { queryKeys } from '../query-keys'

export function useChecks(pullRequestId: string): Check[] {
  const { data } = useQuery<Check[]>({
    queryKey: queryKeys.checks.byPullRequest(pullRequestId),
    queryFn: () => []
  })

  return data ?? []
}
