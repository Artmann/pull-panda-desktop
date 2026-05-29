import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface SettingsState {
  combineTestFiles: boolean
}

const localStorageKey = 'pull-panda-settings'

const initialState: SettingsState = { combineTestFiles: true }

export function loadSettingsFromStorage(): SettingsState {
  try {
    const stored = localStorage.getItem(localStorageKey)

    if (!stored) {
      return { ...initialState }
    }

    const parsed = JSON.parse(stored) as Partial<SettingsState>

    return { combineTestFiles: parsed.combineTestFiles ?? true }
  } catch {
    return { ...initialState }
  }
}

export function saveSettingsToStorage(state: SettingsState): void {
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(state))
  } catch {
    // Ignore storage errors.
  }
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setCombineTestFiles(state, action: PayloadAction<boolean>) {
      state.combineTestFiles = action.payload
    }
  }
})

export const settingsActions = settingsSlice.actions

export default settingsSlice.reducer
