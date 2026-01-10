import { configureStore } from '@reduxjs/toolkit'

import draftsReducer, {
  DraftsState,
  loadDraftsFromStorage,
  saveDraftsToStorage
} from './drafts-slice'
import navigationReducer, { NavigationState } from './navigation-slice'
import pendingReviewsReducer, {
  PendingReviewsState
} from './pending-reviews-slice'
import pullRequestDetailsReducer, {
  PullRequestDetailsState
} from './pull-request-details-slice'
import pullRequestsReducer, { PullRequestsState } from './pull-requests-slice'
import tasksReducer, { TasksState } from './tasks-slice'

export interface PreloadedState {
  drafts?: DraftsState
  navigation?: NavigationState
  pendingReviews?: PendingReviewsState
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
      pendingReviews: pendingReviewsReducer,
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
