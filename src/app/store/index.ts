import { configureStore } from '@reduxjs/toolkit'

import pullRequestsReducer, { PullRequestsState } from './pullRequestsSlice'

export interface PreloadedState {
  pullRequests?: PullRequestsState
}

export function createStore(preloadedState?: PreloadedState) {
  return configureStore({
    preloadedState,
    reducer: {
      pullRequests: pullRequestsReducer
    }
  })
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
