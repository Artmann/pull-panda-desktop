import { eq } from 'drizzle-orm'

import { getDatabase } from '../database'
import { etags, type NewETag } from '../database/schema'

export interface ETagKey {
  endpointType: string
  resourceId: string
}

export interface ETagEntry {
  etag: string
  lastModified: string | null
  validatedAt: string
}

function generateETagId(key: ETagKey): string {
  return `${key.endpointType}:${key.resourceId}`
}

export const etagManager = {
  get(key: ETagKey): ETagEntry | null {
    const database = getDatabase()
    const id = generateETagId(key)

    const result = database
      .select()
      .from(etags)
      .where(eq(etags.id, id))
      .get()

    if (!result) {
      return null
    }

    return {
      etag: result.etag,
      lastModified: result.lastModified,
      validatedAt: result.validatedAt
    }
  },

  set(key: ETagKey, etag: string, lastModified?: string): void {
    const database = getDatabase()
    const id = generateETagId(key)
    const now = new Date().toISOString()

    const entry: NewETag = {
      id,
      endpointType: key.endpointType,
      resourceId: key.resourceId,
      etag,
      lastModified: lastModified ?? null,
      validatedAt: now
    }

    database
      .insert(etags)
      .values(entry)
      .onConflictDoUpdate({
        target: etags.id,
        set: {
          etag: entry.etag,
          lastModified: entry.lastModified,
          validatedAt: entry.validatedAt
        }
      })
      .run()
  },

  delete(key: ETagKey): void {
    const database = getDatabase()
    const id = generateETagId(key)

    database
      .delete(etags)
      .where(eq(etags.id, id))
      .run()
  },

  deleteByEndpointType(endpointType: string): void {
    const database = getDatabase()

    database
      .delete(etags)
      .where(eq(etags.endpointType, endpointType))
      .run()
  },

  deleteAll(): void {
    const database = getDatabase()

    database
      .delete(etags)
      .run()
  }
}
