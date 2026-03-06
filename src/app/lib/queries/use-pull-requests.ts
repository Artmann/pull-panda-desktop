import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { PullRequest } from '@/types/pull-request'

import { queryKeys } from '../query-keys'

// Tracks PR IDs with in-flight optimistic mutations. IPC events skip updating
// these PRs to avoid overwriting optimistic data with stale DB values.
const inFlightPullRequests = new Set<string>()

export function markPullRequestInFlight(id: string): void {
  inFlightPullRequests.add(id)
}

export function clearPullRequestInFlight(id: string): void {
  inFlightPullRequests.delete(id)
}

export function isPullRequestInFlight(id: string): boolean {
  return inFlightPullRequests.has(id)
}

export function usePullRequests(): PullRequest[] {
  const { data } = useQuery<PullRequest[]>({
    queryKey: queryKeys.pullRequests.all,
    queryFn: () => []
  })

  return data ?? []
}

export function usePullRequest(
  id: string | undefined
): PullRequest | undefined {
  const pullRequests = usePullRequests()

  return id ? pullRequests.find((pr) => pr.id === id) : undefined
}

export function useUpsertPullRequest() {
  const queryClient = useQueryClient()

  return (pullRequest: PullRequest) => {
    queryClient.setQueryData<PullRequest[]>(
      queryKeys.pullRequests.all,
      (previous = []) => {
        const index = previous.findIndex((pr) => pr.id === pullRequest.id)

        if (index >= 0) {
          const next = [...previous]
          next[index] = pullRequest

          return next
        }

        return [...previous, pullRequest]
      }
    )
  }
}
