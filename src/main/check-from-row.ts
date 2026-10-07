import type { Check as CheckRow } from '../database/schema'
import type { Check } from '../types/pull-request-details'

// Maps a `checks` table row to the Check shape the renderer works with,
// dropping database-only columns such as `deletedAt`.
export function checkFromRow(row: CheckRow): Check {
  return {
    id: row.id,
    gitHubId: row.gitHubId,
    pullRequestId: row.pullRequestId,
    name: row.name,
    state: row.state,
    conclusion: row.conclusion,
    commitSha: row.commitSha,
    suiteName: row.suiteName,
    durationInSeconds: row.durationInSeconds,
    detailsUrl: row.detailsUrl,
    message: row.message,
    url: row.url,
    gitHubCreatedAt: row.gitHubCreatedAt,
    gitHubUpdatedAt: row.gitHubUpdatedAt,
    syncedAt: row.syncedAt
  }
}
