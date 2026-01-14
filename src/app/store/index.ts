import { configureStore } from '@reduxjs/toolkit'

import draftsReducer, {
  DraftsState,
  loadDraftsFromStorage,
  saveDraftsToStorage
} from './drafts-slice'
import navigationReducer, { NavigationState } from './navigation-slice'
import pendingReviewCommentsReducer, {
  loadPendingReviewCommentsFromStorage,
  PendingReviewCommentsState,
  savePendingReviewCommentsToStorage
} from './pending-review-comments-slice'
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
  pendingReviewComments?: PendingReviewCommentsState
  pendingReviews?: PendingReviewsState
  pullRequestDetails?: PullRequestDetailsState
  pullRequests?: PullRequestsState
  tasks?: TasksState
}

export function createStore(preloadedState?: PreloadedState) {
  const store = configureStore({
    preloadedState: {
      ...preloadedState,
      drafts: loadDraftsFromStorage(),
      pendingReviewComments: loadPendingReviewCommentsFromStorage()
    },
    reducer: {
      drafts: draftsReducer,
      navigation: navigationReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
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

  // Sync pending review comments to localStorage on every change
  let previousPendingReviewComments = store.getState().pendingReviewComments

  store.subscribe(() => {
    const currentPendingReviewComments = store.getState().pendingReviewComments

    if (currentPendingReviewComments !== previousPendingReviewComments) {
      previousPendingReviewComments = currentPendingReviewComments
      savePendingReviewCommentsToStorage(currentPendingReviewComments)
    }
  })

  return store
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
