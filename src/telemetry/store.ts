import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'

import { getWasmPath } from '../database/index'
import {
  computeStats,
  createQueryFunction,
  getTrace,
  queryLogs,
  queryTraces
} from './queries'
import * as schema from './schema'
import { logs, spans, type NewLogRow, type NewSpanRow } from './schema'
import type {
  LogRecord,
  QueryLogsParams,
  QueryTracesParams,
  SpanRecord,
  TelemetryStats,
  TraceDetail,
  TraceSummary
} from './types'

// Telemetry is appended often but persisted to disk lazily. Inserts go straight
// into the in-memory sql.js database (cheap); only the whole-file export is
// expensive, so that is debounced. Retention keeps the file bounded.

const flushIntervalMilliseconds = 3000
const flushBatchThreshold = 250
const maxSpanRows = 20000
const maxLogRows = 20000

interface TelemetryStore {
  readonly recordSpans: (records: SpanRecord[]) => void
  readonly recordLogs: (records: LogRecord[]) => void
  readonly queryTraces: (params: QueryTracesParams) => TraceSummary[]
  readonly getTrace: (traceId: string) => TraceDetail
  readonly queryLogs: (params: QueryLogsParams) => LogRecord[]
  readonly stats: () => TelemetryStats
  readonly flush: () => void
  readonly close: () => void
}

let store: TelemetryStore | null = null

export function getTelemetryStore(): TelemetryStore | null {
  return store
}

export async function initializeTelemetryStore(
  databasePath: string
): Promise<TelemetryStore> {
  if (store) {
    return store
  }

  const wasmBuffer = fs.readFileSync(getWasmPath())
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer
  const sqlJs = await initSqlJs({ wasmBinary })

  let fileBuffer: Buffer | null = null

  if (fs.existsSync(databasePath)) {
    fileBuffer = fs.readFileSync(databasePath)
  }

  const sqlite = fileBuffer
    ? new sqlJs.Database(fileBuffer)
    : new sqlJs.Database()

  createTables(sqlite)

  const database = drizzle(sqlite, { schema })

  store = makeStore(database, sqlite, databasePath)

  return store
}

function createTables(sqlite: SqlJsDatabase): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS spans (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      span_id TEXT NOT NULL,
      parent_span_id TEXT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_ms INTEGER,
      status TEXT NOT NULL,
      status_message TEXT,
      attributes TEXT NOT NULL,
      events TEXT NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS spans_trace_id_idx ON spans (trace_id);
    CREATE INDEX IF NOT EXISTS spans_start_time_idx ON spans (start_time);
    CREATE INDEX IF NOT EXISTS spans_name_idx ON spans (name);
    CREATE INDEX IF NOT EXISTS spans_status_idx ON spans (status);

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      trace_id TEXT,
      span_id TEXT,
      attributes TEXT NOT NULL,
      source TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS logs_timestamp_idx ON logs (timestamp);
    CREATE INDEX IF NOT EXISTS logs_trace_id_idx ON logs (trace_id);
    CREATE INDEX IF NOT EXISTS logs_level_idx ON logs (level);
  `)
}

function makeStore(
  database: SQLJsDatabase<typeof schema>,
  sqlite: SqlJsDatabase,
  databasePath: string
): TelemetryStore {
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let pendingWrites = 0
  let dirty = false

  const query = createQueryFunction(sqlite)

  function persist(): void {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }

    if (!dirty) {
      return
    }

    prune(sqlite)

    const data = sqlite.export()
    const buffer = Buffer.from(data)
    const directory = path.dirname(databasePath)

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true })
    }

    fs.writeFileSync(databasePath, buffer)

    dirty = false
    pendingWrites = 0
  }

  function markDirty(addedRows: number): void {
    dirty = true
    pendingWrites += addedRows

    if (pendingWrites >= flushBatchThreshold) {
      persist()

      return
    }

    if (!flushTimer) {
      flushTimer = setTimeout(persist, flushIntervalMilliseconds)
    }
  }

  return {
    recordSpans: (records) => {
      if (records.length === 0) {
        return
      }

      const rows = records.map(toSpanRow)

      database.insert(spans).values(rows).onConflictDoNothing().run()
      markDirty(rows.length)
    },

    recordLogs: (records) => {
      if (records.length === 0) {
        return
      }

      const rows = records.map(toLogRow)

      database.insert(logs).values(rows).onConflictDoNothing().run()
      markDirty(rows.length)
    },

    queryTraces: (params) => queryTraces(query, params),

    getTrace: (traceId) => getTrace(query, traceId),

    queryLogs: (params) => queryLogs(query, params),

    stats: () => computeStats(query),

    flush: persist,

    close: () => {
      persist()
      sqlite.close()
      store = null
    }
  }
}

function prune(sqlite: SqlJsDatabase): void {
  sqlite.run(
    `DELETE FROM spans WHERE id IN (
       SELECT id FROM spans ORDER BY start_time DESC LIMIT -1 OFFSET ${maxSpanRows}
     )`
  )
  sqlite.run(
    `DELETE FROM logs WHERE id IN (
       SELECT id FROM logs ORDER BY timestamp DESC LIMIT -1 OFFSET ${maxLogRows}
     )`
  )
}

function toSpanRow(record: SpanRecord): NewSpanRow {
  return {
    id: record.id,
    traceId: record.traceId,
    spanId: record.spanId,
    parentSpanId: record.parentSpanId,
    name: record.name,
    kind: record.kind,
    startTime: record.startTime,
    endTime: record.endTime,
    durationMs: record.durationMs,
    status: record.status,
    statusMessage: record.statusMessage,
    attributes: JSON.stringify(record.attributes),
    events: JSON.stringify(record.events),
    source: record.source
  }
}

function toLogRow(record: LogRecord): NewLogRow {
  return {
    id: record.id,
    timestamp: record.timestamp,
    level: record.level,
    message: record.message,
    traceId: record.traceId,
    spanId: record.spanId,
    attributes: JSON.stringify(record.attributes),
    source: record.source
  }
}
