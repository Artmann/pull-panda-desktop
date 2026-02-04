import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { PullRequest } from '@/types/pull-request'

export interface PullRequestsState {
  items: PullRequest[]
}

const initialState: PullRequestsState = {
  items: []
}

export const pullRequestsSlice = createSlice({
  name: 'pullRequests',
  initialState,
  reducers: {
    setItems(state, action: PayloadAction<PullRequest[]>) {
      state.items = action.payload
    },

    upsertItem(state, action: PayloadAction<PullRequest>) {
      const index = state.items.findIndex(
        (pullRequest) => pullRequest.id === action.payload.id
      )

      if (index >= 0) {
        state.items[index] = action.payload
      } else {
        state.items.push(action.payload)
      }
    }
  }
})

export const pullRequestsActions = pullRequestsSlice.actions

export default pullRequestsSlice.reducer
