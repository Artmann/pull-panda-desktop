import type {
  MonitoringData,
  RateLimitRecord,
  SyncRecord
} from '@/types/syncer-monitoring'

const bucketSizeMs = 60000
const maxChartBuckets = 30

interface ChartDataPoint {
  time: string
  timestamp: number
  syncs: number
  restRateLimit: number | null
  graphqlRateLimit: number | null
}

interface BucketData {
  graphqlRateLimits: number[]
  restRateLimits: number[]
  syncs: number
}

export function aggregateData(data: MonitoringData): ChartDataPoint[] {
  if (data.syncs.length === 0 && data.rateLimits.length === 0) {
    return []
  }

  const buckets = createBuckets(data)

  addSyncsToBuckets(buckets, data.syncs)
  addRateLimitsToBuckets(buckets, data.rateLimits)

  const chartData = Array.from(buckets, ([timestamp, bucket]) =>
    toChartDataPoint(timestamp, bucket)
  )

  // Sort by timestamp and limit to the last 30 buckets (30 minutes).
  return chartData
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-maxChartBuckets)
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function addRateLimitsToBuckets(
  buckets: Map<number, BucketData>,
  rateLimits: RateLimitRecord[]
): void {
  for (const rateLimit of rateLimits) {
    const bucket = buckets.get(bucketStart(rateLimit.timestamp))

    if (!bucket) {
      continue
    }

    if (rateLimit.type === 'rest') {
      bucket.restRateLimits.push(rateLimit.remaining)
    } else {
      bucket.graphqlRateLimits.push(rateLimit.remaining)
    }
  }
}

function addSyncsToBuckets(
  buckets: Map<number, BucketData>,
  syncs: SyncRecord[]
): void {
  for (const sync of syncs) {
    const bucket = buckets.get(bucketStart(sync.timestamp))

    if (bucket) {
      bucket.syncs++
    }
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }

  const sum = values.reduce((total, value) => total + value, 0)

  return Math.round(sum / values.length)
}

function bucketStart(timestamp: number): number {
  return Math.floor(timestamp / bucketSizeMs) * bucketSizeMs
}

function createBuckets(data: MonitoringData): Map<number, BucketData> {
  const allTimestamps = [
    ...data.syncs.map((sync) => sync.timestamp),
    ...data.rateLimits.map((rateLimit) => rateLimit.timestamp)
  ]
  const startBucket = bucketStart(Math.min(...allTimestamps))
  const endBucket = bucketStart(Math.max(...allTimestamps))

  const buckets = new Map<number, BucketData>()

  for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSizeMs) {
    buckets.set(bucket, {
      graphqlRateLimits: [],
      restRateLimits: [],
      syncs: 0
    })
  }

  return buckets
}

function toChartDataPoint(
  timestamp: number,
  bucket: BucketData
): ChartDataPoint {
  return {
    time: formatTime(timestamp),
    timestamp,
    syncs: bucket.syncs,
    restRateLimit: average(bucket.restRateLimits),
    graphqlRateLimit: average(bucket.graphqlRateLimits)
  }
}
