import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { CommentReaction } from '@/types/pull-request-details'

export interface ReactionsState {
  items: CommentReaction[]
}

const initialState: ReactionsState = { items: [] }

export const reactionsSlice = createSlice({
  name: 'reactions',
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<CommentReaction[]>) {
      state.items = action.payload
    },

    setForPullRequest(
      state,
      action: PayloadAction<{
        items: CommentReaction[]
        pullRequestId: string
      }>
    ) {
      const { items, pullRequestId } = action.payload

      state.items = [
        ...state.items.filter((item) => item.pullRequestId !== pullRequestId),
        ...items
      ]
    }
  }
})

export const reactionsActions = reactionsSlice.actions
export default reactionsSlice.reducer
