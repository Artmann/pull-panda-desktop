import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface NavigationState {
  activeTab: Record<string, string>
}

const initialState: NavigationState = {
  activeTab: {}
}

export const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setActiveTab(
      state,
      action: PayloadAction<{ pullRequestId: string; tab: string }>
    ) {
      state.activeTab[action.payload.pullRequestId] = action.payload.tab
    }
  }
})

export const navigationActions = navigationSlice.actions

export default navigationSlice.reducer
