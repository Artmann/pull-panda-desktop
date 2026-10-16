import type { MergeAutomation } from '@/types/merge-requirements'

/** Merge options fields for a pull request with no auto-merge and no queue. */
export const noMergeAutomation: MergeAutomation = {
  autoMergeRequest: null,
  isMergeQueueEnabled: false,
  mergeQueueEntry: null,
  mergeQueueMethod: null,
  viewerCanDisableAutoMerge: false,
  viewerCanEnableAutoMerge: false
}
