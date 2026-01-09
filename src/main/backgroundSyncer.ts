import { BrowserWindow } from 'electron'
import { eq, and, isNull, inArray } from 'drizzle-orm'

import { getDatabase } from '../database'
import { checks, pullRequests } from '../database/schema'
import { ipcChannels } from '../lib/ipc/channels'
import { syncChecks } from '../sync/syncChecks'

const syncIntervalWithRunningChecks = 2000
const syncIntervalWithoutRunningChecks = 10000

interface ActivePullRequest {
  id: string
  lastSyncedAt: number
  hasRunningChecks: boolean
}

class BackgroundSyncer {
  private isRunning = false
  private activePullRequests = new Map<string, ActivePullRequest>()
  private timeoutId: NodeJS.Timeout | null = null
  private getToken: (() => string | null) | null = null

  start(getToken: () => string | null): void {
    if (this.isRunning) {
      return
    }

    this.getToken = getToken
    this.isRunning = true

    console.log('[BackgroundSyncer] Started')
    this.scheduleNextSync(0)
  }

  stop(): void {
    this.isRunning = false

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    console.log('[BackgroundSyncer] Stopped')
  }

  markPullRequestActive(pullRequestId: string): void {
    if (!this.activePullRequests.has(pullRequestId)) {
      this.activePullRequests.set(pullRequestId, {
        id: pullRequestId,
        lastSyncedAt: 0,
        hasRunningChecks: false
      })

      console.log(`[BackgroundSyncer] PR ${pullRequestId} marked active`)

      // Trigger immediate sync for newly active PR
      if (this.isRunning) {
        this.scheduleNextSync(0)
      }
    }
  }

  private scheduleNextSync(delay: number): void {
    if (!this.isRunning) {
      return
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    this.timeoutId = setTimeout(() => this.syncLoop(), delay)
  }

  private async syncLoop(): Promise<void> {
    if (!this.isRunning || !this.getToken) {
      return
    }

    const token = this.getToken()

    if (!token) {
      // No token, try again later
      this.scheduleNextSync(5000)

      return
    }

    const now = Date.now()
    let nextSyncDelay = syncIntervalWithoutRunningChecks

    for (const [pullRequestId, activePr] of this.activePullRequests) {
      const interval = activePr.hasRunningChecks
        ? syncIntervalWithRunningChecks
        : syncIntervalWithoutRunningChecks

      const timeSinceLastSync = now - activePr.lastSyncedAt

      if (timeSinceLastSync < interval) {
        // Not time to sync yet, but track the shortest remaining time
        const remaining = interval - timeSinceLastSync
        nextSyncDelay = Math.min(nextSyncDelay, remaining)

        continue
      }

      // Get PR info from database
      const database = getDatabase()
      const pullRequest = database
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.id, pullRequestId))
        .get()

      if (!pullRequest) {
        // PR no longer exists, remove from active list
        this.activePullRequests.delete(pullRequestId)

        continue
      }

      try {
        await syncChecks({
          token,
          pullRequestId,
          owner: pullRequest.repositoryOwner,
          repositoryName: pullRequest.repositoryName,
          pullNumber: pullRequest.number
        })

        // Check if any checks are still running
        const runningChecks = database
          .select()
          .from(checks)
          .where(
            and(
              eq(checks.pullRequestId, pullRequestId),
              isNull(checks.deletedAt),
              inArray(checks.state, ['in_progress', 'queued'])
            )
          )
          .all()

        const hasRunning = runningChecks.length > 0

        // Update active PR state
        activePr.lastSyncedAt = Date.now()
        activePr.hasRunningChecks = hasRunning

        // Notify renderer that sync completed
        this.notifyRenderer(pullRequestId)

        // If this PR has running checks, we want to sync sooner
        if (hasRunning) {
          nextSyncDelay = Math.min(nextSyncDelay, syncIntervalWithRunningChecks)
        }
      } catch (error) {
        console.error(`[BackgroundSyncer] Error syncing PR ${pullRequestId}:`, error)
      }
    }

    // Schedule next sync
    this.scheduleNextSync(nextSyncDelay)
  }

  private notifyRenderer(pullRequestId: string): void {
    const windows = BrowserWindow.getAllWindows()

    for (const window of windows) {
      window.webContents.send(ipcChannels.SyncComplete, {
        type: 'pull-request-details',
        pullRequestId
      })
    }
  }
}

export const backgroundSyncer = new BackgroundSyncer()
