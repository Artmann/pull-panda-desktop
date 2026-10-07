const activeSyncIntervalMs = 10_000
const oneDayMs = 24 * 60 * 60 * 1000
const recentSafetyIntervalMs = 10 * 60_000
const staleSafetyIntervalMs = 30 * 60_000

interface SyncCandidate {
  detailsFingerprint: string | null
  detailsSyncedAt: string | null
  fingerprint: string | null
  id: string
  state: string
  updatedAt: string
}

function hasFingerprintChanged(pullRequest: SyncCandidate): boolean {
  return (
    pullRequest.fingerprint !== null &&
    pullRequest.fingerprint !== pullRequest.detailsFingerprint
  )
}

function isUpdatedSinceDetailsSync(pullRequest: SyncCandidate): boolean {
  if (!pullRequest.detailsSyncedAt) {
    return true
  }

  return (
    new Date(pullRequest.updatedAt).getTime() >
    new Date(pullRequest.detailsSyncedAt).getTime()
  )
}

// Decides whether a pull request is due for a details sync. The list probe
// runs every few seconds and records `updatedAt` (moves on commits, comments
// and reviews) plus a fingerprint (head commit, check rollup, review
// decision), so most changes are caught by those. The time-based rules are a
// safety net for changes neither of them shows, such as reactions.
export function needsSync(
  pullRequest: SyncCandidate,
  activePullRequestIds: Set<string>,
  now: number = Date.now()
): boolean {
  // Merged or closed PRs don't need periodic syncing
  if (pullRequest.state === 'MERGED' || pullRequest.state === 'CLOSED') {
    return false
  }

  if (!pullRequest.detailsSyncedAt) {
    return true
  }

  if (isUpdatedSinceDetailsSync(pullRequest)) {
    return true
  }

  if (hasFingerprintChanged(pullRequest)) {
    return true
  }

  const detailsSyncedAt = new Date(pullRequest.detailsSyncedAt).getTime()

  // Active PRs (user has opened them) sync every 10 seconds
  if (activePullRequestIds.has(pullRequest.id)) {
    return now - detailsSyncedAt > activeSyncIntervalMs
  }

  const updatedAt = new Date(pullRequest.updatedAt).getTime()
  const isRecentlyUpdated = now - updatedAt < oneDayMs
  const safetyIntervalMs = isRecentlyUpdated
    ? recentSafetyIntervalMs
    : staleSafetyIntervalMs

  return now - detailsSyncedAt > safetyIntervalMs
}

// Lower runs first: never-synced PRs (usually ones that were just opened),
// then PRs with a known change, then everything else.
export function syncPriority(pullRequest: SyncCandidate): number {
  if (!pullRequest.detailsSyncedAt) {
    return 0
  }

  if (
    isUpdatedSinceDetailsSync(pullRequest) ||
    hasFingerprintChanged(pullRequest)
  ) {
    return 1
  }

  return 2
}
