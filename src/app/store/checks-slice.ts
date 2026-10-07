import type { Check } from '@/types/pull-request-details'

import {
  createPullRequestItemsSlice,
  type PullRequestItemsState
} from './pull-request-items-slice'

export type ChecksState = PullRequestItemsState<Check>

const checksSlice = createPullRequestItemsSlice<Check, 'checks'>('checks')

export const checksActions = checksSlice.actions
export default checksSlice.reducer
