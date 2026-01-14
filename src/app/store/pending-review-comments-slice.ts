import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface PendingReviewComment {
  body: string
  id: string
  line: number
  path: string
  side: 'LEFT' | 'RIGHT'
}

export interface PendingReviewCommentsState {
  [pullRequestId: string]: PendingReviewComment[]
}

const localStorageKey = 'pull-panda-pending-review-comments'

export function loadPendingReviewCommentsFromStorage(): PendingReviewCommentsState {
  try {
    const stored = localStorage.getItem(localStorageKey)

    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function savePendingReviewCommentsToStorage(
  comments: PendingReviewCommentsState
): void {
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(comments))
  } catch {
    // Ignore storage errors
  }
}

const initialState: PendingReviewCommentsState = {}

export const pendingReviewCommentsSlice = createSlice({
  name: 'pendingReviewComments',
  initialState,
  reducers: {
    addComment(
      state,
      action: PayloadAction<{
        pullRequestId: string
        comment: PendingReviewComment
      }>
    ) {
      const { pullRequestId, comment } = action.payload

      if (!state[pullRequestId]) {
        state[pullRequestId] = []
      }

      state[pullRequestId].push(comment)
    },

    clearComments(state, action: PayloadAction<{ pullRequestId: string }>) {
      delete state[action.payload.pullRequestId]
    },

    loadComments(
      _state,
      action: PayloadAction<PendingReviewCommentsState>
    ) {
      return action.payload
    },

    removeComment(
      state,
      action: PayloadAction<{ pullRequestId: string; commentId: string }>
    ) {
      const { pullRequestId, commentId } = action.payload
      const comments = state[pullRequestId]

      if (comments) {
        state[pullRequestId] = comments.filter(
          (comment) => comment.id !== commentId
        )

        if (state[pullRequestId].length === 0) {
          delete state[pullRequestId]
        }
      }
    },

    updateComment(
      state,
      action: PayloadAction<{
        pullRequestId: string
        commentId: string
        body: string
      }>
    ) {
      const { pullRequestId, commentId, body } = action.payload
      const comments = state[pullRequestId]

      if (comments) {
        const comment = comments.find((c) => c.id === commentId)

        if (comment) {
          comment.body = body
        }
      }
    }
  }
})

export const pendingReviewCommentsActions = pendingReviewCommentsSlice.actions

export default pendingReviewCommentsSlice.reducer
