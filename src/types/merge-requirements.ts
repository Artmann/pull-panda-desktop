export interface MergeRequirement {
  description: string
  key: string
  label: string
  satisfied: boolean
}

export type MergeMethod = 'merge' | 'rebase' | 'squash'

/** A request to merge the pull request once its requirements are met. */
export interface AutoMergeRequest {
  enabledAt: string | null
  enabledByLogin: string | null
  /** Null when the base branch uses a merge queue, which sets the method. */
  mergeMethod: MergeMethod | null
}

export type MergeQueueEntryState =
  | 'AWAITING_CHECKS'
  | 'LOCKED'
  | 'MERGEABLE'
  | 'QUEUED'
  | 'UNMERGEABLE'

/** Where the pull request sits in its base branch's merge queue. */
export interface MergeQueueEntry {
  enqueuedAt: string | null
  /** GitHub's estimate in seconds. Null when it has none. */
  estimatedTimeToMerge: number | null
  /** 1-based. Null until GitHub has placed the entry. */
  position: number | null
  state: MergeQueueEntryState
}

/** Auto-merge and merge queue state for a pull request. */
export interface MergeAutomation {
  autoMergeRequest: AutoMergeRequest | null
  isMergeQueueEnabled: boolean
  mergeQueueEntry: MergeQueueEntry | null
  /** The method the merge queue merges with, when it uses one. */
  mergeQueueMethod: MergeMethod | null
  viewerCanDisableAutoMerge: boolean
  viewerCanEnableAutoMerge: boolean
}
