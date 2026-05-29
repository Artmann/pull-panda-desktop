import { configureStore } from '@reduxjs/toolkit'

import checksReducer, { ChecksState } from './checks-slice'
import commentsReducer, { CommentsState } from './comments-slice'
import commitsReducer, { CommitsState } from './commits-slice'
import connectedReposReducer, {
  ConnectedReposState
} from './connected-repos-slice'
import draftsReducer, {
  DraftsState,
  loadDraftsFromStorage,
  saveDraftsToStorage
} from './drafts-slice'
import mergeOptionsReducer, { MergeOptionsState } from './merge-options-slice'
import modifiedFilesReducer, {
  ModifiedFilesState
} from './modified-files-slice'
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
import recentReviewersReducer, {
  loadRecentReviewersFromStorage,
  RecentReviewersState,
  saveRecentReviewersToStorage
} from './recent-reviewers-slice'
import reviewerSuggestionsReducer, {
  ReviewerSuggestionsState
} from './reviewer-suggestions-slice'
import reviewsReducer, { ReviewsState } from './reviews-slice'
import reviewThreadsReducer, {
  ReviewThreadsState
} from './review-threads-slice'
import settingsReducer, {
  loadSettingsFromStorage,
  SettingsState,
  saveSettingsToStorage
} from './settings-slice'
import tasksReducer, { TasksState } from './tasks-slice'

export interface PreloadedState {
  checks: ChecksState
  comments: CommentsState
  commits: CommitsState
  connectedRepos?: ConnectedReposState
  drafts?: DraftsState
  mergeOptions?: MergeOptionsState
  modifiedFiles: ModifiedFilesState
  pendingReviewComments?: PendingReviewCommentsState
  pendingReviews?: PendingReviewsState
  pullRequests?: PullRequestsState
  reactions: ReactionsState
  recentReviewers?: RecentReviewersState
  reviewerSuggestions?: ReviewerSuggestionsState
  reviews: ReviewsState
  reviewThreads: ReviewThreadsState
  settings?: SettingsState
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
      pendingReviewComments: loadPendingReviewCommentsFromStorage(),
      recentReviewers: loadRecentReviewersFromStorage(),
      settings: loadSettingsFromStorage()
    },
    reducer: {
      checks: checksReducer,
      comments: commentsReducer,
      commits: commitsReducer,
      connectedRepos: connectedReposReducer,
      drafts: draftsReducer,
      mergeOptions: mergeOptionsReducer,
      modifiedFiles: modifiedFilesReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer,
      reactions: reactionsReducer,
      recentReviewers: recentReviewersReducer,
      reviewerSuggestions: reviewerSuggestionsReducer,
      reviews: reviewsReducer,
      reviewThreads: reviewThreadsReducer,
      settings: settingsReducer,
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

  // Sync recent reviewers to localStorage on every change
  let previousRecentReviewers = store.getState().recentReviewers

  store.subscribe(() => {
    const currentRecentReviewers = store.getState().recentReviewers

    if (currentRecentReviewers !== previousRecentReviewers) {
      previousRecentReviewers = currentRecentReviewers
      saveRecentReviewersToStorage(currentRecentReviewers)
    }
  })

  // Sync settings to localStorage on every change
  let previousSettings = store.getState().settings

  store.subscribe(() => {
    const currentSettings = store.getState().settings

    if (currentSettings !== previousSettings) {
      previousSettings = currentSettings
      saveSettingsToStorage(currentSettings)
    }
  })

  return store
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
