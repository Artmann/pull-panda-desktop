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
      return 'Ready to merge'
    case 'dirty':
      return 'Has conflicts'
    case 'unstable':
      return 'Checks failing'
    default:
      return 'Cannot merge'
  }
}

// Stricter than `canMergeNow`: GitHub lets an unstable pull request merge, but
// failing checks should not be presented as the go-ahead.
export function isReadyToMerge(options: MergeOptions | null): boolean {
  return canMergeNow(options) && options?.mergeableState !== 'unstable'
}
