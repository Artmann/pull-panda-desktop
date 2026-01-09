export interface SyncRecord {
  id: string
  timestamp: number
  duration: number
  resourceType: 'checks' | 'commits' | 'comments'
  resourceId: string
  success: boolean
  error?: string
}

export interface RateLimitRecord {
  timestamp: number
  remaining: number
  limit: number
  type: 'rest' | 'graphql'
}

export interface MonitoringData {
  syncs: SyncRecord[]
  rateLimits: RateLimitRecord[]
  activePullRequests: string[]
}
