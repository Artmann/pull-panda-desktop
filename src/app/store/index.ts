import { configureStore } from '@reduxjs/toolkit'

import navigationReducer, { NavigationState } from './navigationSlice'
import pullRequestsReducer, { PullRequestsState } from './pullRequestsSlice'

export interface PreloadedState {
  navigation?: NavigationState
  pullRequests?: PullRequestsState
}

export function createStore(preloadedState?: PreloadedState) {
  return configureStore({
    preloadedState,
    reducer: {
      navigation: navigationReducer,
      pullRequests: pullRequestsReducer
    }
  })
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
