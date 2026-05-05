import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ConnectedReposState {
  byFullName: Record<string, string>
  checkoutsInProgress: Record<string, true>
  initialized: boolean
}

const initialState: ConnectedReposState = {
  byFullName: {},
  checkoutsInProgress: {},
  initialized: false
}

const connectedReposSlice = createSlice({
  name: 'connectedRepos',
  initialState,
  reducers: {
    clearCheckoutInProgress(
      state,
      action: PayloadAction<{ pullRequestId: string }>
    ) {
      delete state.checkoutsInProgress[action.payload.pullRequestId]
    },

    removeRepo(state, action: PayloadAction<{ fullName: string }>) {
      delete state.byFullName[action.payload.fullName]
    },

    setAll(state, action: PayloadAction<Record<string, string>>) {
      state.byFullName = action.payload
      state.initialized = true
    },

    setCheckoutInProgress(
      state,
      action: PayloadAction<{ pullRequestId: string }>
    ) {
      state.checkoutsInProgress[action.payload.pullRequestId] = true
    },

    setRepo(
      state,
      action: PayloadAction<{ fullName: string; localPath: string }>
    ) {
      state.byFullName[action.payload.fullName] = action.payload.localPath
    }
  }
})

export const connectedReposActions = connectedReposSlice.actions

export default connectedReposSlice.reducer
