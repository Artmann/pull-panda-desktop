import { createSlice } from '@reduxjs/toolkit'

import type { PullRequest } from '@/types/pullRequest'

export interface PullRequestsState {
  items: PullRequest[]
}

const initialState: PullRequestsState = {
  items: []
}

export const pullRequestsSlice = createSlice({
  name: 'pullRequests',
  initialState,
  reducers: {}
})

export const pullRequestsActions = pullRequestsSlice.actions

export default pullRequestsSlice.reducer
