import { describe, expect, it } from 'vitest'

import type {
  MonitoringData,
  RateLimitRecord,
  SyncRecord
} from '@/types/syncer-monitoring'

import { aggregateData, formatTime } from './aggregateData'

const minuteMs = 60000

// Built from local-time components so the formatted bucket labels are
// deterministic regardless of the machine's timezone.
const baseTime = new Date(2026, 0, 1, 10, 0, 0).getTime()

function createMonitoringData(
  overrides: Partial<MonitoringData> = {}
): MonitoringData {
  return {
    activePullRequests: [],
    rateLimits: [],
    syncs: [],
    ...overrides
  }
}

function createRateLimit(
  overrides: Partial<RateLimitRecord> = {}
): RateLimitRecord {
  return {
    limit: 5000,
    remaining: 5000,
    timestamp: baseTime,
    type: 'rest',
    ...overrides
  }
}

function createSync(overrides: Partial<SyncRecord> = {}): SyncRecord {
  return {
    duration: 100,
    id: 'sync-1',
    resourceId: 'pr-1',
    resourceType: 'details',
    success: true,
    timestamp: baseTime,
    ...overrides
  }
}

describe('aggregateData', () => {
  it('returns an empty array when there is no data', () => {
    expect(aggregateData(createMonitoringData())).toEqual([])
  })

  it('counts syncs per minute bucket and zero-fills gaps', () => {
    const data = createMonitoringData({
      syncs: [
        createSync({ id: 'sync-1', timestamp: baseTime + 10000 }),
        createSync({ id: 'sync-2', timestamp: baseTime + 20000 }),
        createSync({ id: 'sync-3', timestamp: baseTime + 2 * minuteMs + 30000 })
      ]
    })

    expect(aggregateData(data)).toEqual([
      {
        graphqlRateLimit: null,
        restRateLimit: null,
        syncs: 2,
        time: '10:00:00',
        timestamp: baseTime
      },
      {
        graphqlRateLimit: null,
        restRateLimit: null,
        syncs: 0,
        time: '10:01:00',
        timestamp: baseTime + minuteMs
      },
      {
        graphqlRateLimit: null,
        restRateLimit: null,
        syncs: 1,
        time: '10:02:00',
        timestamp: baseTime + 2 * minuteMs
      }
    ])
  })

  it('averages rate limits per bucket, separated by type', () => {
    const data = createMonitoringData({
      rateLimits: [
        createRateLimit({ remaining: 4000, timestamp: baseTime + 5000 }),
        createRateLimit({ remaining: 5001, timestamp: baseTime + 15000 }),
        createRateLimit({
          remaining: 9000,
          timestamp: baseTime + 25000,
          type: 'graphql'
        })
      ]
    })

    expect(aggregateData(data)).toEqual([
      {
        graphqlRateLimit: 9000,
        restRateLimit: 4501,
        syncs: 0,
        time: '10:00:00',
        timestamp: baseTime
      }
    ])
  })

  it('combines syncs and rate limits across the full time range', () => {
    const data = createMonitoringData({
      rateLimits: [createRateLimit({ remaining: 4800, timestamp: baseTime })],
      syncs: [createSync({ timestamp: baseTime + minuteMs })]
    })

    expect(aggregateData(data)).toEqual([
      {
        graphqlRateLimit: null,
        restRateLimit: 4800,
        syncs: 0,
        time: '10:00:00',
        timestamp: baseTime
      },
      {
        graphqlRateLimit: null,
        restRateLimit: null,
        syncs: 1,
        time: '10:01:00',
        timestamp: baseTime + minuteMs
      }
    ])
  })

  it('limits the output to the most recent 30 buckets', () => {
    const data = createMonitoringData({
      syncs: [
        createSync({ id: 'sync-first', timestamp: baseTime }),
        createSync({ id: 'sync-last', timestamp: baseTime + 35 * minuteMs })
      ]
    })

    const chartData = aggregateData(data)

    expect(chartData).toHaveLength(30)
    expect(chartData[0]).toEqual({
      graphqlRateLimit: null,
      restRateLimit: null,
      syncs: 0,
      time: '10:06:00',
      timestamp: baseTime + 6 * minuteMs
    })
    expect(chartData[29]).toEqual({
      graphqlRateLimit: null,
      restRateLimit: null,
      syncs: 1,
      time: '10:35:00',
      timestamp: baseTime + 35 * minuteMs
    })
  })
})

describe('formatTime', () => {
  it('formats a timestamp as a 24-hour time string', () => {
    const timestamp = new Date(2026, 0, 1, 17, 5, 9).getTime()

    expect(formatTime(timestamp)).toEqual('17:05:09')
  })
})
