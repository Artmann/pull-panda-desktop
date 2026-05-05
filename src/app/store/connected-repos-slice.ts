import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ConnectedReposState {
  byFullName: Record<string, string>
  initialized: boolean
}

const initialState: ConnectedReposState = {
  byFullName: {},
  initialized: false
}

const connectedReposSlice = createSlice({
  name: 'connectedRepos',
  initialState,
  reducers: {
    removeRepo(state, action: PayloadAction<{ fullName: string }>) {
      delete state.byFullName[action.payload.fullName]
    },

    setAll(state, action: PayloadAction<Record<string, string>>) {
      state.byFullName = action.payload
      state.initialized = true
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
