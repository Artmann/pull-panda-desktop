import { BrowserWindow } from 'electron'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { parallel } from 'radash'

import { getDatabase } from '../database'
import { checks, pullRequests } from '../database/schema'
import { ipcChannels } from '../lib/ipc/channels'
import { getPullRequest, getPullRequestDetails } from './bootstrap'
import { syncChecks } from '../sync/sync-checks'
import { rateLimitManager } from '../sync/rate-limit-manager'
import type {
  MonitoringData,
  RateLimitRecord,
  SyncRecord
} from '../types/syncer-monitoring'

const syncIntervalWithRunningChecks = 2000
const syncIntervalWithoutRunningChecks = 10000
const maxHistorySize = 1000

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
  private syncHistory: SyncRecord[] = []
  private rateLimitHistory: RateLimitRecord[] = []
  private syncIdCounter = 0

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

    // Collect PRs that are due for sync
    const database = getDatabase()

    interface PrToSync {
      activePr: ActivePullRequest
      owner: string
      pullNumber: number
      pullRequestId: string
      repositoryName: string
    }

    const prsToSync: PrToSync[] = []

    for (const [pullRequestId, activePr] of this.activePullRequests) {
      const interval = activePr.hasRunningChecks
        ? syncIntervalWithRunningChecks
        : syncIntervalWithoutRunningChecks

      const timeSinceLastSync = now - activePr.lastSyncedAt

      if (timeSinceLastSync < interval) {
        const remaining = interval - timeSinceLastSync
        nextSyncDelay = Math.min(nextSyncDelay, remaining)

        continue
      }

      const pullRequest = database
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.id, pullRequestId))
        .get()

      if (!pullRequest) {
        this.activePullRequests.delete(pullRequestId)

        continue
      }

      prsToSync.push({
        activePr,
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        pullRequestId,
        repositoryName: pullRequest.repositoryName
      })
    }

    // Sync up to 3 PRs concurrently
    await parallel(3, prsToSync, async (item) => {
      const syncStartTime = Date.now()
      const syncId = `sync-${++this.syncIdCounter}`
      let syncSuccess = true
      let syncError: string | undefined

      try {
        await syncChecks({
          token,
          pullRequestId: item.pullRequestId,
          owner: item.owner,
          repositoryName: item.repositoryName,
          pullNumber: item.pullNumber
        })

        const runningChecks = database
          .select()
          .from(checks)
          .where(
            and(
              eq(checks.pullRequestId, item.pullRequestId),
              isNull(checks.deletedAt),
              inArray(checks.state, ['in_progress', 'queued'])
            )
          )
          .all()

        const hasRunning = runningChecks.length > 0

        item.activePr.lastSyncedAt = Date.now()
        item.activePr.hasRunningChecks = hasRunning

        this.notifyRenderer(item.pullRequestId)
      } catch (error) {
        syncSuccess = false
        syncError = error instanceof Error ? error.message : 'Unknown error'
        console.error(
          `[BackgroundSyncer] Error syncing PR ${item.pullRequestId}:`,
          error
        )
      }

      const syncEndTime = Date.now()
      this.recordSync({
        id: syncId,
        timestamp: syncStartTime,
        duration: syncEndTime - syncStartTime,
        resourceType: 'checks',
        resourceId: item.pullRequestId,
        success: syncSuccess,
        error: syncError
      })

      this.recordRateLimit()
    })

    // Compute next delay from updated active PR states
    for (const [, activePr] of this.activePullRequests) {
      if (activePr.hasRunningChecks) {
        nextSyncDelay = Math.min(nextSyncDelay, syncIntervalWithRunningChecks)
      }
    }

    // Schedule next sync
    this.scheduleNextSync(nextSyncDelay)
  }

  private async notifyRenderer(pullRequestId: string): Promise<void> {
    const details = await getPullRequestDetails(pullRequestId)
    const pullRequest = await getPullRequest(pullRequestId)
    const windows = BrowserWindow.getAllWindows()

    for (const window of windows) {
      if (details) {
        window.webContents.send(ipcChannels.ResourceUpdated, {
          type: 'checks',
          pullRequestId,
          data: details.checks
        })
      }

      if (pullRequest) {
        window.webContents.send(ipcChannels.ResourceUpdated, {
          type: 'pull-request',
          pullRequestId,
          data: pullRequest
        })
      }
    }
  }

  private recordSync(record: SyncRecord): void {
    this.syncHistory.push(record)

    console.log(
      `[BackgroundSyncer] Recorded sync: ${record.resourceType}:${record.resourceId} took ${record.duration}ms, success=${record.success}`
    )

    // Keep history bounded
    if (this.syncHistory.length > maxHistorySize) {
      this.syncHistory.shift()
    }
  }

  private recordRateLimit(): void {
    const now = Date.now()

    // Record REST rate limit
    const restRemaining = rateLimitManager.getRemainingQuota('rest')
    const restState = rateLimitManager.rest

    if (restRemaining !== null && restState) {
      this.rateLimitHistory.push({
        timestamp: now,
        remaining: restRemaining,
        limit: restState.limit,
        type: 'rest'
      })
    }

    // Record GraphQL rate limit
    const graphqlRemaining = rateLimitManager.getRemainingQuota('graphql')
    const graphqlState = rateLimitManager.graphql

    if (graphqlRemaining !== null && graphqlState) {
      this.rateLimitHistory.push({
        timestamp: now,
        remaining: graphqlRemaining,
        limit: graphqlState.limit,
        type: 'graphql'
      })
    }

    // Keep history bounded
    while (this.rateLimitHistory.length > maxHistorySize) {
      this.rateLimitHistory.shift()
    }
  }

  getActivePullRequestIds(): Set<string> {
    return new Set(this.activePullRequests.keys())
  }

  getMonitoringData(): MonitoringData {
    const data = {
      syncs: [...this.syncHistory],
      rateLimits: [...this.rateLimitHistory],
      activePullRequests: Array.from(this.activePullRequests.keys())
    }

    console.log(
      `[BackgroundSyncer] getMonitoringData: ${data.syncs.length} syncs, ${data.rateLimits.length} rateLimits, ${data.activePullRequests.length} active PRs`
    )

    return data
  }
}

export const backgroundSyncer = new BackgroundSyncer()
