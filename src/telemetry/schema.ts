import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// These tables live in their own `pull-panda-telemetry.db`, never in the synced
// `pull-panda.db`. They are created idempotently on store init (see `store.ts`)
// rather than through drizzle-kit migrations, because telemetry is disposable:
// deleting the file resets it.

export const spans = sqliteTable(
  'spans',
  {
    id: text('id').primaryKey(),
    traceId: text('trace_id').notNull(),
    spanId: text('span_id').notNull(),
    parentSpanId: text('parent_span_id'),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    startTime: integer('start_time').notNull(),
    endTime: integer('end_time'),
    durationMs: integer('duration_ms'),
    status: text('status').notNull(),
    statusMessage: text('status_message'),
    attributes: text('attributes').notNull(),
    events: text('events').notNull(),
    source: text('source').notNull()
  },
  (table) => [
    index('spans_trace_id_idx').on(table.traceId),
    index('spans_start_time_idx').on(table.startTime),
    index('spans_name_idx').on(table.name),
    index('spans_status_idx').on(table.status)
  ]
)

export const logs = sqliteTable(
  'logs',
  {
    id: text('id').primaryKey(),
    timestamp: integer('timestamp').notNull(),
    level: text('level').notNull(),
    message: text('message').notNull(),
    traceId: text('trace_id'),
    spanId: text('span_id'),
    attributes: text('attributes').notNull(),
    source: text('source').notNull()
  },
  (table) => [
    index('logs_timestamp_idx').on(table.timestamp),
    index('logs_trace_id_idx').on(table.traceId),
    index('logs_level_idx').on(table.level)
  ]
)

export type SpanRow = typeof spans.$inferSelect
export type NewSpanRow = typeof spans.$inferInsert
export type LogRow = typeof logs.$inferSelect
export type NewLogRow = typeof logs.$inferInsert
