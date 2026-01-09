import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type {
  Check,
  Comment,
  PullRequestDetails
} from '@/types/pull-request-details'

export interface PullRequestDetailsState {
  [pullRequestId: string]: PullRequestDetails | undefined
}

const initialState: PullRequestDetailsState = {}

export const pullRequestDetailsSlice = createSlice({
  name: 'pullRequestDetails',
  initialState,
  reducers: {
    setDetails(
      state,
      action: PayloadAction<{
        pullRequestId: string
        details: PullRequestDetails
      }>
    ) {
      const { pullRequestId, details } = action.payload

      // When setting details, preserve any optimistic comments (temp- prefix)
      const existing = state[pullRequestId]
      const optimisticComments =
        existing?.comments.filter((c) => c.id.startsWith('temp-')) ?? []

      state[pullRequestId] = {
        ...details,
        comments: [...details.comments, ...optimisticComments]
      }
    },

    addComment(
      state,
      action: PayloadAction<{ pullRequestId: string; comment: Comment }>
    ) {
      const { pullRequestId, comment } = action.payload
      const details = state[pullRequestId]

      if (details) {
        details.comments.push(comment)
      }
    },

    removeComment(
      state,
      action: PayloadAction<{ pullRequestId: string; commentId: string }>
    ) {
      const { pullRequestId, commentId } = action.payload
      const details = state[pullRequestId]

      if (details) {
        details.comments = details.comments.filter((c) => c.id !== commentId)
      }
    },

    setChecks(
      state,
      action: PayloadAction<{ pullRequestId: string; checks: Check[] }>
    ) {
      const { pullRequestId, checks } = action.payload
      const details = state[pullRequestId]

      if (details) {
        details.checks = checks
      }
    }
  }
})

export const pullRequestDetailsActions = pullRequestDetailsSlice.actions

export default pullRequestDetailsSlice.reducer

// Helper to create optimistic comment
export function createOptimisticComment(params: {
  body: string
  pullRequestId: string
  userLogin: string
  userAvatarUrl: string
  parentCommentGitHubId?: string
  gitHubReviewThreadId?: string
}): Comment {
  const tempId = `temp-${crypto.randomUUID()}`

  return {
    id: tempId,
    gitHubId: tempId,
    gitHubNumericId: null,
    pullRequestId: params.pullRequestId,
    reviewId: null,
    body: params.body,
    bodyHtml: null,
    path: null,
    line: null,
    originalLine: null,
    diffHunk: null,
    commitId: null,
    originalCommitId: null,
    gitHubReviewId: null,
    gitHubReviewThreadId: params.gitHubReviewThreadId ?? null,
    parentCommentGitHubId: params.parentCommentGitHubId ?? null,
    userLogin: params.userLogin,
    userAvatarUrl: params.userAvatarUrl,
    url: null,
    gitHubCreatedAt: new Date().toISOString(),
    gitHubUpdatedAt: null,
    syncedAt: new Date().toISOString()
  }
}
