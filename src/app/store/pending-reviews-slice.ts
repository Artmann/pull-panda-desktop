import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface PendingReview {
  authorAvatarUrl: string | null
  authorLogin: string | null
  body: string | null
  gitHubId: string
  gitHubNumericId: number | null
  id: string
  isCollapsed: boolean
  pullRequestId: string
  state: string
}

export interface PendingReviewsState {
  [pullRequestId: string]: PendingReview | undefined
}

const initialState: PendingReviewsState = {}

export function createOptimisticReview(pullRequestId: string): PendingReview {
  const tempId = `temp-${crypto.randomUUID()}`

  return {
    authorAvatarUrl: null,
    authorLogin: null,
    body: null,
    gitHubId: tempId,
    gitHubNumericId: 0,
    id: tempId,
    isCollapsed: false,
    pullRequestId,
    state: 'PENDING'
  }
}

const pendingReviewsSlice = createSlice({
  name: 'pendingReviews',
  initialState,
  reducers: {
    clearReview(state, action: PayloadAction<{ pullRequestId: string }>) {
      delete state[action.payload.pullRequestId]
    },

    setAll(_state, action: PayloadAction<PendingReviewsState>) {
      return action.payload
    },

    setCollapsed(
      state,
      action: PayloadAction<{ collapsed: boolean; pullRequestId: string }>
    ) {
      const review = state[action.payload.pullRequestId]

      if (!review) {
        return
      }

      review.isCollapsed = action.payload.collapsed
    },

    setReview(
      state,
      action: PayloadAction<{ pullRequestId: string; review: PendingReview }>
    ) {
      const existing = state[action.payload.pullRequestId]

      state[action.payload.pullRequestId] = {
        ...action.payload.review,
        isCollapsed: existing
          ? existing.isCollapsed
          : action.payload.review.isCollapsed
      }
    }
  }
})

export const pendingReviewsActions = pendingReviewsSlice.actions

export default pendingReviewsSlice.reducer
