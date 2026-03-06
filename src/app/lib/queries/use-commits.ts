import { useQuery } from '@tanstack/react-query'

import type { Commit } from '@/types/pull-request-details'

import { queryKeys } from '../query-keys'

export function useCommits(pullRequestId: string): Commit[] {
  const { data } = useQuery<Commit[]>({
    queryKey: queryKeys.commits.byPullRequest(pullRequestId),
    queryFn: () => []
  })

  return data ?? []
}
