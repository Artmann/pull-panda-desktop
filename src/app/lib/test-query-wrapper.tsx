import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'

import { queryKeys } from './query-keys'

import type { PullRequest } from '@/types/pull-request'
import type {
  Check,
  Comment,
  CommentReaction,
  Commit,
  ModifiedFile,
  Review
} from '@/types/pull-request-details'

interface QueryWrapperOptions {
  checks?: Check[]
  comments?: Comment[]
  commits?: Commit[]
  modifiedFiles?: ModifiedFile[]
  pullRequests?: PullRequest[]
  reactions?: CommentReaction[]
  reviews?: Review[]
}

export function createTestQueryClient(
  options: QueryWrapperOptions = {}
): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity
      }
    }
  })

  if (options.pullRequests) {
    queryClient.setQueryData(queryKeys.pullRequests.all, options.pullRequests)
  }

  // Group by pullRequestId and set per-PR queries
  const groupAndSet = <T extends { pullRequestId: string }>(
    items: T[] | undefined,
    keyFn: (id: string) => readonly string[]
  ) => {
    if (!items) return

    const grouped = new Map<string, T[]>()

    for (const item of items) {
      const group = grouped.get(item.pullRequestId)

      if (group) {
        group.push(item)
      } else {
        grouped.set(item.pullRequestId, [item])
      }
    }

    for (const [id, group] of grouped) {
      queryClient.setQueryData(keyFn(id), group)
    }
  }

  groupAndSet(options.checks, queryKeys.checks.byPullRequest)
  groupAndSet(options.comments, queryKeys.comments.byPullRequest)
  groupAndSet(options.commits, queryKeys.commits.byPullRequest)
  groupAndSet(options.modifiedFiles, queryKeys.modifiedFiles.byPullRequest)
  groupAndSet(options.reactions, queryKeys.reactions.byPullRequest)
  groupAndSet(options.reviews, queryKeys.reviews.byPullRequest)

  return queryClient
}

export function QueryWrapper({
  children,
  client
}: {
  children: ReactNode
  client: QueryClient
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
