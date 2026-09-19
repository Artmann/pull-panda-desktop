import type { MergeOptions } from '@/app/lib/api'

// The merge control reports the blocking reason rather than a bare "Merge", so
// the footer bar says why a merge cannot proceed without opening the drawer.
export function getMergeButtonLabel(options: MergeOptions | null): string {
  if (!options) {
    return 'Merge'
  }

  if (options.mergeable === true) {
    return 'Ready to merge'
  }

  if (options.mergeable === null) {
    return 'Checking...'
  }

  switch (options.mergeableState) {
    case 'blocked':
      return 'Merge blocked'
    case 'dirty':
      return 'Has conflicts'
    case 'unstable':
      return 'Checks failing'
    default:
      return 'Cannot merge'
  }
}
