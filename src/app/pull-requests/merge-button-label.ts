import type { MergeOptions } from '@/app/lib/api'

// GitHub's `mergeable` only says whether the branch merges without conflicts.
// Whether the merge is actually allowed (required reviews, code owners, strict
// status checks, drafts) is carried by the merge state status instead.
const mergeableStates = new Set(['clean', 'has_hooks', 'unstable'])

export function canMergeNow(options: MergeOptions | null): boolean {
  return (
    options?.mergeable === true && mergeableStates.has(options.mergeableState)
  )
}

// The merge control reports the blocking reason rather than a bare "Merge", so
// the footer bar says why a merge cannot proceed without opening the drawer.
export function getMergeButtonLabel(options: MergeOptions | null): string {
  if (!options) {
    return 'Merge'
  }

  // A pull request that is already on its way in says so before anything else.
  if (options.mergeQueueEntry) {
    return options.mergeQueueEntry.position === null
      ? 'In merge queue'
      : `In merge queue (#${options.mergeQueueEntry.position})`
  }

  if (options.autoMergeRequest) {
    return options.isMergeQueueEnabled
      ? 'Queued when ready'
      : 'Auto-merge enabled'
  }

  if (options.mergeable === null || options.mergeableState === 'unknown') {
    return 'Checking...'
  }

  switch (options.mergeableState) {
    case 'behind':
      return 'Branch out of date'
    case 'blocked':
      return 'Merge blocked'
    case 'clean':
    case 'has_hooks':
      return 'Merge pull request'
    case 'dirty':
      return 'Has conflicts'
    case 'unstable':
      return 'Checks failing'
    default:
      return 'Cannot merge'
  }
}

// Stricter than `canMergeNow`: GitHub lets an unstable pull request merge, but
// failing checks should not be presented as the go-ahead. Nor is there anything
// left to do once the pull request is queued or set to auto-merge.
export function isReadyToMerge(options: MergeOptions | null): boolean {
  return (
    options !== null &&
    canMergeNow(options) &&
    options.mergeableState !== 'unstable' &&
    !options.autoMergeRequest &&
    !options.mergeQueueEntry
  )
}
