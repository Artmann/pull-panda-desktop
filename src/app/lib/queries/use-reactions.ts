import { useQuery } from '@tanstack/react-query'

import type { CommentReaction } from '@/types/pull-request-details'

import { queryKeys } from '../query-keys'

export function useReactions(pullRequestId: string): CommentReaction[] {
  const { data } = useQuery<CommentReaction[]>({
    queryKey: queryKeys.reactions.byPullRequest(pullRequestId),
    queryFn: () => []
  })

  return data ?? []
}
