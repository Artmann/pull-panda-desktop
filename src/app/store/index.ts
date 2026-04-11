import { configureStore } from '@reduxjs/toolkit'

import checksReducer, { ChecksState } from './checks-slice'
import commentsReducer, { CommentsState } from './comments-slice'
import commitsReducer, { CommitsState } from './commits-slice'
import draftsReducer, {
  DraftsState,
  loadDraftsFromStorage,
  saveDraftsToStorage
} from './drafts-slice'
import mergeOptionsReducer, {
  MergeOptionsState
} from './merge-options-slice'
import modifiedFilesReducer, {
  ModifiedFilesState
} from './modified-files-slice'
import navigationReducer, { NavigationState } from './navigation-slice'
import pendingReviewCommentsReducer, {
  loadPendingReviewCommentsFromStorage,
  PendingReviewCommentsState,
  savePendingReviewCommentsToStorage
} from './pending-review-comments-slice'
import pendingReviewsReducer, {
  PendingReviewsState
} from './pending-reviews-slice'
import pullRequestsReducer, { PullRequestsState } from './pull-requests-slice'
import reactionsReducer, { ReactionsState } from './reactions-slice'
import reviewsReducer, { ReviewsState } from './reviews-slice'
import tasksReducer, { TasksState } from './tasks-slice'

export interface PreloadedState {
  checks: ChecksState
  comments: CommentsState
  commits: CommitsState
  drafts?: DraftsState
  mergeOptions?: MergeOptionsState
  modifiedFiles: ModifiedFilesState
  navigation?: NavigationState
  pendingReviewComments?: PendingReviewCommentsState
  pendingReviews?: PendingReviewsState
  pullRequests?: PullRequestsState
  reactions: ReactionsState
  reviews: ReviewsState
  tasks?: TasksState
}

export function createStore(preloadedState?: PreloadedState) {
  const store = configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false
      }),
    preloadedState: {
      ...preloadedState,
      drafts: loadDraftsFromStorage(),
      pendingReviewComments: loadPendingReviewCommentsFromStorage()
    },
    reducer: {
      checks: checksReducer,
      comments: commentsReducer,
      commits: commitsReducer,
      drafts: draftsReducer,
      mergeOptions: mergeOptionsReducer,
      modifiedFiles: modifiedFilesReducer,
      navigation: navigationReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer,
      reactions: reactionsReducer,
      reviews: reviewsReducer,
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
