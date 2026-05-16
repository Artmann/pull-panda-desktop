import { Context, Effect, Layer, Option } from 'effect'
import { eq } from 'drizzle-orm'

import { etags, type NewETag } from '../../database/schema'
import {
  type DatabaseNotInitializedError,
  type DatabaseQueryError
} from '../errors'
import type { ETagEntry, ETagKey } from '../schemas/domain'
import { Database } from './database'

function generateETagId(key: ETagKey): string {
  return `${key.endpointType}:${key.resourceId}`
}

type StoreError = DatabaseNotInitializedError | DatabaseQueryError

export class EtagStore extends Context.Tag('sync/EtagStore')<
  EtagStore,
  {
    readonly get: (
      key: ETagKey
    ) => Effect.Effect<Option.Option<ETagEntry>, StoreError>
    readonly set: (
      key: ETagKey,
      etag: string,
      lastModified?: string
    ) => Effect.Effect<void, StoreError>
    readonly remove: (key: ETagKey) => Effect.Effect<void, StoreError>
  }
>() {}

export const EtagStoreLive: Layer.Layer<EtagStore, never, Database> =
  Layer.effect(
    EtagStore,
    Effect.gen(function* () {
      const database = yield* Database

      return {
        get: (key) =>
          database.use('etagStore.get', (db) => {
            const id = generateETagId(key)
            const row = db.select().from(etags).where(eq(etags.id, id)).get()

            if (!row) {
              return Option.none<ETagEntry>()
            }

            return Option.some<ETagEntry>({
              etag: row.etag,
              lastModified: row.lastModified,
              validatedAt: row.validatedAt
            })
          }),

        set: (key, etag, lastModified) =>
          database.use('etagStore.set', (db) => {
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

            db.insert(etags)
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
          }),

        remove: (key) =>
          database.use('etagStore.remove', (db) => {
            const id = generateETagId(key)

            db.delete(etags).where(eq(etags.id, id)).run()
          })
      }
    })
  )
