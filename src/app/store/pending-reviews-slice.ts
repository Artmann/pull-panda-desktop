import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface PendingReview {
  authorAvatarUrl: string | null
  authorLogin: string | null
  body: string | null
  gitHubId: string
  gitHubNumericId: number
  id: string
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
    pullRequestId,
    state: 'PENDING'
  }
}

export const pendingReviewsSlice = createSlice({
  name: 'pendingReviews',
  initialState,
  reducers: {
    clearReview(state, action: PayloadAction<{ pullRequestId: string }>) {
      delete state[action.payload.pullRequestId]
    },

    setReview(
      state,
      action: PayloadAction<{ pullRequestId: string; review: PendingReview }>
    ) {
      state[action.payload.pullRequestId] = action.payload.review
    }
  }
})

export const pendingReviewsActions = pendingReviewsSlice.actions

export default pendingReviewsSlice.reducer
