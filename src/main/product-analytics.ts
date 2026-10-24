import { count, eq, sql } from 'drizzle-orm'
import { app } from 'electron'
import { PostHog } from 'posthog-node'

import { getDatabase } from '../database'
import { pullRequests } from '../database/schema'
import {
  type ProductEvent,
  type RendererProductEvent,
  rendererProductEventNames,
  toCountBucket
} from '../types/product-analytics'
import { isUsageReportingEnabled, loadUsageSettings } from './usage-settings'

// PostHog project keys can only write events, not read them, so shipping one
// in the app is safe and expected.
const posthogProjectKey = 'phc_nNVKHqbkERimfLpxrbzytiUE6P8WRSk6WVQ3R2cgRwt7'
const posthogHost =
  process.env.PULL_PANDA_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

const activeCheckIntervalMs = 60 * 60 * 1000
const shutdownTimeoutMs = 2000

// Renderer-supplied string values must look like identifiers. This rejects
// anything resembling free text even if a caller sidesteps the typed catalog.
const identifierPattern = /^[a-z0-9][a-z0-9.+_-]{0,63}$/

let client: PostHog | null = null
let lastActiveDay: string | null = null

export function isProductAnalyticsAllowed(): boolean {
  const doNotTrack = process.env.DO_NOT_TRACK

  if (doNotTrack === '1' || doNotTrack === 'true') {
    return false
  }

  // Dev builds stay out of the numbers unless explicitly opted in for testing.
  if (!app.isPackaged && process.env.PULL_PANDA_PRODUCT_ANALYTICS !== '1') {
    return false
  }

  return isUsageReportingEnabled()
}

export function parseRendererProductEvent(
  payload: unknown
): RendererProductEvent | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const { name, properties } = payload as Record<string, unknown>

  if (
    typeof name !== 'string' ||
    !rendererProductEventNames.some((eventName) => eventName === name)
  ) {
    return null
  }

  if (properties === undefined) {
    return payload as RendererProductEvent
  }

  if (typeof properties !== 'object' || properties === null) {
    return null
  }

  const isSafe = Object.values(properties).every(
    (value) =>
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      (typeof value === 'string' && identifierPattern.test(value))
  )

  return isSafe ? (payload as RendererProductEvent) : null
}

export async function shutdownProductAnalytics(): Promise<void> {
  if (!client) {
    return
  }

  try {
    await client.shutdown(shutdownTimeoutMs)
  } catch {
    // Unsent events are dropped on quit rather than delaying it.
  }
}

export function startProductAnalytics(): void {
  lastActiveDay = currentDay()

  trackProductEvent({ name: 'app_opened', properties: readWorkspaceSize() })

  // Long-running sessions still count as active on each day they span.
  setInterval(() => {
    const today = currentDay()

    if (today === lastActiveDay) {
      return
    }

    lastActiveDay = today
    trackProductEvent({ name: 'app_active' })
  }, activeCheckIntervalMs)
}

export function trackProductEvent(event: ProductEvent): void {
  try {
    if (!isProductAnalyticsAllowed()) {
      return
    }

    getClient().capture({
      disableGeoip: true,
      distinctId: loadUsageSettings().installId,
      event: event.name,
      properties: {
        appVersion: app.getVersion(),
        osVersion: process.getSystemVersion(),
        platform: process.platform,
        ...('properties' in event ? event.properties : {})
      }
    })
  } catch {
    // Analytics are best-effort and must never surface anywhere in the UI.
  }
}

function currentDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function getClient(): PostHog {
  client ??= new PostHog(posthogProjectKey, {
    disableGeoip: true,
    host: posthogHost
  })

  return client
}

function readWorkspaceSize(): Extract<
  ProductEvent,
  { name: 'app_opened' }
>['properties'] {
  try {
    const [row] = getDatabase()
      .select({
        openPullRequestCount: count(),
        repositoryCount: sql<number>`count(distinct ${pullRequests.repositoryOwner} || '/' || ${pullRequests.repositoryName})`
      })
      .from(pullRequests)
      .where(eq(pullRequests.state, 'OPEN'))
      .all()

    return {
      openPullRequestCount: toCountBucket(row?.openPullRequestCount ?? 0),
      repositoryCount: toCountBucket(row?.repositoryCount ?? 0)
    }
  } catch {
    return { openPullRequestCount: '0', repositoryCount: '0' }
  }
}
