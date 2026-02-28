import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { Review } from '@/types/pull-request-details'

export interface ReviewsState {
  items: Review[]
}

const initialState: ReviewsState = { items: [] }

export const reviewsSlice = createSlice({
  name: 'reviews',
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<Review[]>) {
      state.items = action.payload
    },

    setForPullRequest(
      state,
      action: PayloadAction<{ items: Review[]; pullRequestId: string }>
    ) {
      const { items, pullRequestId } = action.payload

      state.items = [
        ...state.items.filter((item) => item.pullRequestId !== pullRequestId),
        ...items
      ]
    }
  }
})

export const reviewsActions = reviewsSlice.actions
export default reviewsSlice.reducer
