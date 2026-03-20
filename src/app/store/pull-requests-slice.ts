import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { PullRequest } from '@/types/pull-request'

export interface PullRequestsState {
  items: PullRequest[]
  /** Count from last bulk list sync (includes PRs still awaiting detail sync). */
  listCount: number
}

const initialState: PullRequestsState = {
  items: [],
  listCount: 0
}

export const pullRequestsSlice = createSlice({
  name: 'pullRequests',
  initialState,
  reducers: {
    setFromListSync(
      state,
      action: PayloadAction<{ items: PullRequest[]; listCount: number }>
    ) {
      state.items = action.payload.items
      state.listCount = action.payload.listCount
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
