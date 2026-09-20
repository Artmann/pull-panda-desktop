import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Which pull request's MergeDrawer is open. The drawer is opened from the
// footer action bar but rendered by PullRequestPage, so the flag has to live in
// the store rather than in either component.
export interface MergeDrawerState {
  openForPullRequestId: string | null
}

const initialState: MergeDrawerState = {
  openForPullRequestId: null
}

const mergeDrawerSlice = createSlice({
  name: 'mergeDrawer',
  initialState,
  reducers: {
    close(state) {
      state.openForPullRequestId = null
    },

    open(state, action: PayloadAction<{ pullRequestId: string }>) {
      state.openForPullRequestId = action.payload.pullRequestId
    }
  }
})

export const mergeDrawerActions = mergeDrawerSlice.actions

export default mergeDrawerSlice.reducer
