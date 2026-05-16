export interface RelationFlags {
  isAuthor: boolean
  isAssignee: boolean
  isReviewer: boolean
}

export interface ProbeEntry extends RelationFlags {
  id: string
  updatedAt: string
}

export interface SyncResult {
  synced: number
  syncedIds: Set<string>
  errors: ReadonlyArray<string>
  hasChanges: boolean
}

export interface SyncPullRequestDetailsResult {
  errors: ReadonlyArray<string>
  notFound: boolean
  success: boolean
}

export interface ETagKey {
  endpointType: string
  resourceId: string
}

export interface ETagEntry {
  etag: string
  lastModified: string | null
  validatedAt: string
}
