import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { Comment } from '@/types/pull-request-details'

import { queryKeys } from '../query-keys'

export function useComments(pullRequestId: string): Comment[] {
  const { data } = useQuery<Comment[]>({
    queryKey: queryKeys.comments.byPullRequest(pullRequestId),
    queryFn: () => []
  })

  return data ?? []
}

export function useAddComment() {
  const queryClient = useQueryClient()

  return (pullRequestId: string, comment: Comment) => {
    queryClient.setQueryData<Comment[]>(
      queryKeys.comments.byPullRequest(pullRequestId),
      (previous = []) => [...previous, comment]
    )
  }
}

export function useRemoveComment() {
  const queryClient = useQueryClient()

  return (pullRequestId: string, commentId: string) => {
    queryClient.setQueryData<Comment[]>(
      queryKeys.comments.byPullRequest(pullRequestId),
      (previous = []) => previous.filter((c) => c.id !== commentId)
    )
  }
}

export function createOptimisticComment(params: {
  body: string
  gitHubReviewThreadId?: string
  parentCommentGitHubId?: string
  pullRequestId: string
  userAvatarUrl: string
  userLogin: string
}): Comment {
  const tempId = `temp-${crypto.randomUUID()}`

  return {
    body: params.body,
    bodyHtml: null,
    commitId: null,
    diffHunk: null,
    gitHubCreatedAt: new Date().toISOString(),
    gitHubId: tempId,
    gitHubNumericId: null,
    gitHubReviewId: null,
    gitHubReviewThreadId: params.gitHubReviewThreadId ?? null,
    gitHubUpdatedAt: null,
    id: tempId,
    line: null,
    originalCommitId: null,
    originalLine: null,
    parentCommentGitHubId: params.parentCommentGitHubId ?? null,
    path: null,
    pullRequestId: params.pullRequestId,
    reviewId: null,
    syncedAt: new Date().toISOString(),
    url: null,
    userAvatarUrl: params.userAvatarUrl,
    userLogin: params.userLogin
  }
}
