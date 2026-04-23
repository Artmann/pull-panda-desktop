import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { ModifiedFile } from '@/types/pull-request-details'

export interface ModifiedFilesState {
  items: ModifiedFile[]
}

const initialState: ModifiedFilesState = { items: [] }

const modifiedFilesSlice = createSlice({
  name: 'modifiedFiles',
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<ModifiedFile[]>) {
      state.items = action.payload
    },

    setForPullRequest(
      state,
      action: PayloadAction<{ items: ModifiedFile[]; pullRequestId: string }>
    ) {
      const { items, pullRequestId } = action.payload

      state.items = [
        ...state.items.filter((item) => item.pullRequestId !== pullRequestId),
        ...items
      ]
    }
  }
})

export const modifiedFilesActions = modifiedFilesSlice.actions
export default modifiedFilesSlice.reducer
