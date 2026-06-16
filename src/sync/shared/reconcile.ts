import { and, eq, isNull, type SQL } from 'drizzle-orm'
import {
  type SQLiteColumn,
  type SQLiteTable,
  type SQLiteUpdateSetSource
} from 'drizzle-orm/sqlite-core'

import { getDatabase } from '../../database'
import {
  commentReactions,
  type NewCommentReaction
} from '../../database/schema'
import { type Reaction } from '../schemas/github-rest'
import { generateId } from './utils'

type DrizzleDb = ReturnType<typeof getDatabase>

interface ReconcileColumns {
  id: SQLiteColumn
  deletedAt: SQLiteColumn
}

interface ReconcileOptions<
  Table extends SQLiteTable & ReconcileColumns,
  Item
> {
  // The live rows this reconcile owns, expressed as the `where` conditions that
  // select them (e.g. `eq(table.pullRequestId, id)`). The non-deleted filter is
  // always added on top, so callers never repeat `isNull(table.deletedAt)`.
  scope: ReadonlyArray<SQL>
  items: ReadonlyArray<Item>
  // The natural key shared by an incoming item and an existing row. When they
  // match, the existing row's id is reused so the upsert updates in place.
  keyOfItem: (item: Item) => string
  keyOfRow: (row: Table['$inferSelect']) => string
  build: (item: Item, existingId: string | undefined) => Table['$inferInsert']
  now: string
  // Live rows for which this predicate returns true are never soft-deleted, even
  // when absent from `items` (e.g. PENDING reviews owned by explicit actions).
  protectFromDelete?: (row: Table['$inferSelect']) => boolean
}

// The single place the sync layer's fetch → reconcile → soft-delete dance lives.
// Loads the live rows in `scope`, upserts every item (reusing the existing id
// when an item's natural key already maps to one), then soft-deletes any live
// row whose key is absent from the items. Returns the reconciled id for each
// item so callers can drive follow-up work (reactions, thread links).
export const reconcileBySoftDelete = <
  Table extends SQLiteTable & ReconcileColumns,
  Item
>(
  db: DrizzleDb,
  table: Table,
  options: ReconcileOptions<Table, Item>
): Array<{ id: string; item: Item }> => {
  const existing = db
    .select()
    .from(table)
    .where(and(isNull(table.deletedAt), ...options.scope))
    .all() as Array<Table['$inferSelect']>

  const syncedKeys = new Set<string>()
  const entries: Array<{ id: string; item: Item }> = []

  for (const item of options.items) {
    const key = options.keyOfItem(item)
    syncedKeys.add(key)

    const existingRow = existing.find((row) => options.keyOfRow(row) === key)
    const record = options.build(item, existingRow?.id)
    const recordId = (record as { id: string }).id

    const updatableFields: Record<string, unknown> = { deletedAt: null }

    for (const [column, value] of Object.entries(record)) {
      if (column !== 'id') {
        updatableFields[column] = value
      }
    }

    db.insert(table)
      .values(record)
      .onConflictDoUpdate({
        target: table.id,
        set: updatableFields as SQLiteUpdateSetSource<Table>
      })
      .run()

    entries.push({ id: recordId, item })
  }

  for (const row of existing) {
    const key = options.keyOfRow(row)

    if (syncedKeys.has(key)) {
      continue
    }

    if (options.protectFromDelete?.(row) === true) {
      continue
    }

    db.update(table)
      .set({ deletedAt: options.now } as SQLiteUpdateSetSource<Table>)
      .where(eq(table.id, row.id))
      .run()
  }

  return entries
}

// Reactions hang off both issue comments and review comments with an identical
// shape, so the reconcile against them lives here once. Reactions whose author
// is unknown are skipped — GitHub omits the user on deleted accounts and there
// is nothing to attribute them to.
export const reconcileCommentReactions = (
  db: DrizzleDb,
  options: {
    commentId: string
    pullRequestId: string
    reactions: ReadonlyArray<Reaction>
    now: string
  }
): void => {
  const withUser = options.reactions.filter(
    (
      reaction
    ): reaction is Reaction & { user: NonNullable<Reaction['user']> } =>
      reaction.user != null
  )

  reconcileBySoftDelete(db, commentReactions, {
    scope: [eq(commentReactions.commentId, options.commentId)],
    items: withUser,
    keyOfItem: (reaction) => reaction.node_id,
    keyOfRow: (row) => row.gitHubId,
    build: (reaction, existingId): NewCommentReaction => ({
      id: existingId ?? generateId(),
      gitHubId: reaction.node_id,
      commentId: options.commentId,
      pullRequestId: options.pullRequestId,
      content: reaction.content,
      userLogin: reaction.user.login,
      userId: String(reaction.user.id),
      syncedAt: options.now,
      deletedAt: null
    }),
    now: options.now
  })
}
