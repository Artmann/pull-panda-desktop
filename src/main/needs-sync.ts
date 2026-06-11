const activeSyncIntervalMs = 10_000
const oneDayMs = 24 * 60 * 60 * 1000
const recentSyncIntervalMs = 60_000
const staleSyncIntervalMs = 5 * 60_000

interface SyncCandidate {
  detailsSyncedAt: string | null
  id: string
  state: string
  updatedAt: string
}

// Decides whether a pull request is due for a details sync based on how
// recently it changed on GitHub and whether the user has it open.
export function needsSync(
  pullRequest: SyncCandidate,
  activePullRequestIds: Set<string>,
  now: number = Date.now()
): boolean {
  // Merged or closed PRs don't need periodic syncing
  if (pullRequest.state === 'MERGED' || pullRequest.state === 'CLOSED') {
    return false
  }

  // Never synced before
  if (!pullRequest.detailsSyncedAt) {
    return true
  }

  const detailsSyncedAt = new Date(pullRequest.detailsSyncedAt).getTime()
  const updatedAt = new Date(pullRequest.updatedAt).getTime()

  // Updated on GitHub since last sync
  if (updatedAt > detailsSyncedAt) {
    return true
  }

  // Active PRs (user has opened them) sync every 10 seconds
  if (activePullRequestIds.has(pullRequest.id)) {
    return now - detailsSyncedAt > activeSyncIntervalMs
  }

  // Recently updated open PRs sync every 60 seconds
  const isRecentlyUpdated = now - updatedAt < oneDayMs

  if (isRecentlyUpdated) {
    return now - detailsSyncedAt > recentSyncIntervalMs
  }

  // Older open PRs sync every 5 minutes
  return now - detailsSyncedAt > staleSyncIntervalMs
}
