import type { Review } from '@/types/pull-request-details'

import {
  createPullRequestItemsSlice,
  type PullRequestItemsState
} from './pull-request-items-slice'

export type ReviewsState = PullRequestItemsState<Review>

const reviewsSlice = createPullRequestItemsSlice<Review, 'reviews'>('reviews')

export const reviewsActions = reviewsSlice.actions
export default reviewsSlice.reducer
