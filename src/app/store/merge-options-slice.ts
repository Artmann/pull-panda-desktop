import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { MergeOptions } from '@/app/lib/api'

export interface MergeOptionsState {
  [pullRequestId: string]: MergeOptions | null
}

const initialState: MergeOptionsState = {}

export const mergeOptionsSlice = createSlice({
  name: 'mergeOptions',
  initialState,
  reducers: {
    clearForPullRequest(state, action: PayloadAction<string>) {
      state[action.payload] = null
    },

    setForPullRequest(
      state,
      action: PayloadAction<{
        options: MergeOptions
        pullRequestId: string
      }>
    ) {
      const { options, pullRequestId } = action.payload

      state[pullRequestId] = options
    }
  }
})

export const mergeOptionsActions = mergeOptionsSlice.actions
export default mergeOptionsSlice.reducer
