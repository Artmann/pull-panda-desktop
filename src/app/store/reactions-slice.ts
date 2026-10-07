import type { CommentReaction } from '@/types/pull-request-details'

import {
  createPullRequestItemsSlice,
  type PullRequestItemsState
} from './pull-request-items-slice'

export type ReactionsState = PullRequestItemsState<CommentReaction>

const reactionsSlice = createPullRequestItemsSlice<
  CommentReaction,
  'reactions'
>('reactions')

export const reactionsActions = reactionsSlice.actions
export default reactionsSlice.reducer
