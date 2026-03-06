import { useQuery } from '@tanstack/react-query'

import type { ModifiedFile } from '@/types/pull-request-details'

import { queryKeys } from '../query-keys'

export function useModifiedFiles(pullRequestId: string): ModifiedFile[] {
  const { data } = useQuery<ModifiedFile[]>({
    queryKey: queryKeys.modifiedFiles.byPullRequest(pullRequestId),
    queryFn: () => []
  })

  return data ?? []
}
