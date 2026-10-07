import type { ModifiedFile } from '@/types/pull-request-details'

import {
  createPullRequestItemsSlice,
  type PullRequestItemsState
} from './pull-request-items-slice'

export type ModifiedFilesState = PullRequestItemsState<ModifiedFile>

const modifiedFilesSlice = createPullRequestItemsSlice<
  ModifiedFile,
  'modifiedFiles'
>('modifiedFiles')

export const modifiedFilesActions = modifiedFilesSlice.actions
export default modifiedFilesSlice.reducer
