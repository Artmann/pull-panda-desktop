import { configureStore } from '@reduxjs/toolkit'

import draftsReducer, {
  DraftsState,
  loadDraftsFromStorage,
  saveDraftsToStorage
} from './draftsSlice'
import navigationReducer, { NavigationState } from './navigationSlice'
import pullRequestDetailsReducer, {
  PullRequestDetailsState
} from './pullRequestDetailsSlice'
import pullRequestsReducer, { PullRequestsState } from './pullRequestsSlice'
import tasksReducer, { TasksState } from './tasksSlice'

export interface PreloadedState {
  drafts?: DraftsState
  navigation?: NavigationState
  pullRequestDetails?: PullRequestDetailsState
  pullRequests?: PullRequestsState
  tasks?: TasksState
}

export function createStore(preloadedState?: PreloadedState) {
  const store = configureStore({
    preloadedState: {
      ...preloadedState,
      drafts: loadDraftsFromStorage()
    },
    reducer: {
      drafts: draftsReducer,
      navigation: navigationReducer,
      pullRequestDetails: pullRequestDetailsReducer,
      pullRequests: pullRequestsReducer,
      tasks: tasksReducer
    }
  })

  // Sync drafts to localStorage on every change
  let previousDrafts = store.getState().drafts

  store.subscribe(() => {
    const currentDrafts = store.getState().drafts

    if (currentDrafts !== previousDrafts) {
      previousDrafts = currentDrafts
      saveDraftsToStorage(currentDrafts)
    }
  })

  return store
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
