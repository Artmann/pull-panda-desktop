import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { Comment } from '@/types/pull-request-details'

export interface CommentsState {
  items: Comment[]
}

const initialState: CommentsState = { items: [] }

const commentsSlice = createSlice({
  name: 'comments',
  initialState,
  reducers: {
    addComment(
      state,
      action: PayloadAction<{ comment: Comment; pullRequestId: string }>
    ) {
      state.items.push(action.payload.comment)
    },

    removeComment(
      state,
      action: PayloadAction<{ commentId: string; pullRequestId: string }>
    ) {
      state.items = state.items.filter(
        (item) => item.id !== action.payload.commentId
      )
    },

    setAll(state, action: PayloadAction<Comment[]>) {
      state.items = action.payload
    },

    setForPullRequest(
      state,
      action: PayloadAction<{ items: Comment[]; pullRequestId: string }>
    ) {
      const { items, pullRequestId } = action.payload

      // Preserve optimistic comments (temp- prefixed IDs).
      const optimisticComments = state.items.filter(
        (item) =>
          item.pullRequestId === pullRequestId && item.id.startsWith('temp-')
      )

      state.items = [
        ...state.items.filter((item) => item.pullRequestId !== pullRequestId),
        ...items,
        ...optimisticComments
      ]
    }
  }
})

export const commentsActions = commentsSlice.actions
export default commentsSlice.reducer

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
