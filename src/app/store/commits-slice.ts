import type { Commit } from '@/types/pull-request-details'

import {
  createPullRequestItemsSlice,
  type PullRequestItemsState
} from './pull-request-items-slice'

export type CommitsState = PullRequestItemsState<Commit>

const commitsSlice = createPullRequestItemsSlice<Commit, 'commits'>('commits')

export const commitsActions = commitsSlice.actions
export default commitsSlice.reducer
