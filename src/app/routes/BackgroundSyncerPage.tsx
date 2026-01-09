import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { ArrowLeft, Activity, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/app/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import { BarChart, MultiLineChart } from '@/app/components/ui/chart'
import type { MonitoringData, SyncRecord } from '@/types/syncer-monitoring'

const refreshInterval = 2000
const bucketSizeMs = 60000

interface ChartDataPoint {
  time: string
  timestamp: number
  syncs: number
  restRateLimit: number | null
  graphqlRateLimit: number | null
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  return `${(ms / 1000).toFixed(2)}s`
}

interface BucketData {
  syncs: number
  restRateLimits: number[]
  graphqlRateLimits: number[]
}

function aggregateData(data: MonitoringData): ChartDataPoint[] {
  if (data.syncs.length === 0 && data.rateLimits.length === 0) {
    return []
  }

  // Find time range
  const allTimestamps = [
    ...data.syncs.map((s) => s.timestamp),
    ...data.rateLimits.map((r) => r.timestamp)
  ]
  const minTime = Math.min(...allTimestamps)
  const maxTime = Math.max(...allTimestamps)

  // Create buckets
  const buckets = new Map<number, BucketData>()
  const startBucket = Math.floor(minTime / bucketSizeMs) * bucketSizeMs
  const endBucket = Math.floor(maxTime / bucketSizeMs) * bucketSizeMs

  // Initialize buckets
  for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSizeMs) {
    buckets.set(bucket, { syncs: 0, restRateLimits: [], graphqlRateLimits: [] })
  }

  // Aggregate syncs
  for (const sync of data.syncs) {
    const bucket = Math.floor(sync.timestamp / bucketSizeMs) * bucketSizeMs
    const existing = buckets.get(bucket)

    if (existing) {
      existing.syncs++
    }
  }

  // Aggregate rate limits by type
  for (const rateLimit of data.rateLimits) {
    const bucket = Math.floor(rateLimit.timestamp / bucketSizeMs) * bucketSizeMs
    const existing = buckets.get(bucket)

    if (existing) {
      if (rateLimit.type === 'rest') {
        existing.restRateLimits.push(rateLimit.remaining)
      } else {
        existing.graphqlRateLimits.push(rateLimit.remaining)
      }
    }
  }

  // Convert to chart data
  const chartData: ChartDataPoint[] = []

  for (const [timestamp, value] of buckets) {
    const avgRestRateLimit =
      value.restRateLimits.length > 0
        ? Math.round(
            value.restRateLimits.reduce((a, b) => a + b, 0) /
              value.restRateLimits.length
          )
        : null

    const avgGraphqlRateLimit =
      value.graphqlRateLimits.length > 0
        ? Math.round(
            value.graphqlRateLimits.reduce((a, b) => a + b, 0) /
              value.graphqlRateLimits.length
          )
        : null

    chartData.push({
      time: formatTime(timestamp),
      timestamp,
      syncs: value.syncs,
      restRateLimit: avgRestRateLimit,
      graphqlRateLimit: avgGraphqlRateLimit
    })
  }

  // Sort by timestamp and limit to last 30 buckets (5 minutes)
  return chartData.sort((a, b) => a.timestamp - b.timestamp).slice(-30)
}

export function BackgroundSyncerPage(): ReactElement {
  const [data, setData] = useState<MonitoringData | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const stats = await window.electron.getSyncerStats()

      console.log('[BackgroundSyncerPage] Fetched stats:', stats)
      setData(stats)
    } catch (error) {
      console.error('Failed to fetch syncer stats:', error)
    }
  }, [])

  useEffect(
    function pollForData() {
      fetchData()

      const intervalId = setInterval(fetchData, refreshInterval)

      return () => clearInterval(intervalId)
    },
    [fetchData]
  )

  const chartData = data ? aggregateData(data) : []
  const recentSyncs = data?.syncs.slice(-20).reverse() ?? []
  const successCount = data?.syncs.filter((s) => s.success).length ?? 0
  const errorCount = data?.syncs.filter((s) => !s.success).length ?? 0
  const activePrCount = data?.activePullRequests.length ?? 0

  return (
    <div className="w-full max-w-240 mx-auto px-6 py-4">
      <div className="mb-6">
        <Link to="/">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <h1 className="text-2xl font-bold">Background Syncer Monitor</h1>
        <p className="text-muted-foreground text-sm">
          Real-time monitoring of sync operations and rate limits.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active PRs
            </CardDescription>
            <CardTitle className="text-2xl">{activePrCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Successful Syncs
            </CardDescription>
            <CardTitle className="text-2xl">{successCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Failed Syncs
            </CardDescription>
            <CardTitle className="text-2xl">{errorCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Syncs per Minute</CardTitle>
            <CardDescription>
              Number of sync operations per minute
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <BarChart
                data={chartData}
                xKey="time"
                yKey="syncs"
                barColor="hsl(142.1 76.2% 36.3%)"
                formatTooltip={(value) => `${value} syncs`}
              />
            ) : (
              <div className="h-75 flex items-center justify-center text-muted-foreground">
                No sync data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate Limit Remaining</CardTitle>
            <CardDescription>
              GitHub API quota over time (REST and GraphQL)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.some(
              (d) => d.restRateLimit !== null || d.graphqlRateLimit !== null
            ) ? (
              <MultiLineChart
                data={chartData}
                xKey="time"
                lines={[
                  {
                    key: 'restRateLimit',
                    label: 'REST',
                    color: 'hsl(221.2 83.2% 53.3%)'
                  },
                  {
                    key: 'graphqlRateLimit',
                    label: 'GraphQL',
                    color: 'hsl(262.1 83.3% 57.8%)'
                  }
                ]}
                referenceLine={100}
              />
            ) : (
              <div className="h-75 flex items-center justify-center text-muted-foreground">
                No rate limit data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Syncs</CardTitle>
          <CardDescription>Last 20 sync operations</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSyncs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Resource</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSyncs.map((sync) => (
                    <SyncRow
                      key={sync.id}
                      sync={sync}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No syncs recorded yet. Open a pull request to start syncing.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SyncRow({ sync }: { sync: SyncRecord }): ReactElement {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2">
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {formatTime(sync.timestamp)}
        </div>
      </td>
      <td className="py-2">
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {sync.resourceType}:{sync.resourceId.slice(0, 12)}...
        </code>
      </td>
      <td className="py-2 text-muted-foreground">
        {formatDuration(sync.duration)}
      </td>
      <td className="py-2">
        {sync.success ? (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            OK
          </span>
        ) : (
          <span
            className="flex items-center gap-1 text-red-600"
            title={sync.error}
          >
            <XCircle className="h-3 w-3" />
            Error
          </span>
        )}
      </td>
    </tr>
  )
}
