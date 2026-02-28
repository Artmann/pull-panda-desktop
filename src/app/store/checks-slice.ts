import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { Check } from '@/types/pull-request-details'

export interface ChecksState {
  items: Check[]
}

const initialState: ChecksState = { items: [] }

export const checksSlice = createSlice({
  name: 'checks',
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<Check[]>) {
      state.items = action.payload
    },

    setForPullRequest(
      state,
      action: PayloadAction<{ items: Check[]; pullRequestId: string }>
    ) {
      const { items, pullRequestId } = action.payload

      state.items = [
        ...state.items.filter((item) => item.pullRequestId !== pullRequestId),
        ...items
      ]
    }
  }
})

export const checksActions = checksSlice.actions
export default checksSlice.reducer
