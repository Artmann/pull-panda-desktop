import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { Commit } from '@/types/pull-request-details'

export interface CommitsState {
  items: Commit[]
}

const initialState: CommitsState = { items: [] }

const commitsSlice = createSlice({
  name: 'commits',
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<Commit[]>) {
      state.items = action.payload
    },

    setForPullRequest(
      state,
      action: PayloadAction<{ items: Commit[]; pullRequestId: string }>
    ) {
      const { items, pullRequestId } = action.payload

      state.items = [
        ...state.items.filter((item) => item.pullRequestId !== pullRequestId),
        ...items
      ]
    }
  }
})

export const commitsActions = commitsSlice.actions
export default commitsSlice.reducer
