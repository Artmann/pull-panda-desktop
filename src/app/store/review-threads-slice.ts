import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { ReviewThread } from '@/types/pull-request-details'

export interface ReviewThreadsState {
  items: ReviewThread[]
}

const initialState: ReviewThreadsState = { items: [] }

export const reviewThreadsSlice = createSlice({
  name: 'reviewThreads',
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<ReviewThread[]>) {
      state.items = action.payload
    },

    setForPullRequest(
      state,
      action: PayloadAction<{ items: ReviewThread[]; pullRequestId: string }>
    ) {
      const { items, pullRequestId } = action.payload

      state.items = [
        ...state.items.filter((item) => item.pullRequestId !== pullRequestId),
        ...items
      ]
    },

    updateResolution(
      state,
      action: PayloadAction<{
        gitHubId: string
        isResolved: boolean
        resolvedByLogin: string | null
      }>
    ) {
      const { gitHubId, isResolved, resolvedByLogin } = action.payload
      const thread = state.items.find((item) => item.gitHubId === gitHubId)

      if (thread) {
        thread.isResolved = isResolved
        thread.resolvedByLogin = resolvedByLogin
      }
    }
  }
})

export const reviewThreadsActions = reviewThreadsSlice.actions
export default reviewThreadsSlice.reducer
