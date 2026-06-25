import type { Database } from 'sql.js'

import type {
  LogRecord,
  OperationStat,
  QueryLogsParams,
  QueryTracesParams,
  SpanRecord,
  TelemetryStats,
  TraceDetail,
  TraceSummary
} from './types'

// Pure query and (de)serialization helpers shared by the main-process telemetry
// store and the `inspect-traces` CLI. They depend only on a `QueryFunction`, so
// the CLI can reuse them without booting Electron.

interface SqlRow {
  [column: string]: number | string | null
}

export type QueryFunction = (
  sql: string,
  params?: Array<number | string>
) => SqlRow[]

const defaultTraceLimit = 100
const defaultLogLimit = 200

// Computes the nesting depth of each span from its parent chain. Shared by the
// dashboard waterfall and the CLI so both indent spans identically.
export function spanDepths(spans: SpanRecord[]): Map<string, number> {
  const byId = new Map(spans.map((span) => [span.spanId, span]))
  const depths = new Map<string, number>()

  const depthFor = (spanId: string): number => {
    const cached = depths.get(spanId)

    if (cached !== undefined) {
      return cached
    }

    const parentId = byId.get(spanId)?.parentSpanId
    const depth = parentId && byId.has(parentId) ? depthFor(parentId) + 1 : 0

    depths.set(spanId, depth)

    return depth
  }

  for (const span of spans) {
    depthFor(span.spanId)
  }

  return depths
}

// Builds a `QueryFunction` over a sql.js database instance. Shared so the store,
// the CLI, and tests run reads through identical statement handling.
export function createQueryFunction(sqlite: Database): QueryFunction {
  return (sql, params = []) => {
    const statement = sqlite.prepare(sql)

    statement.bind(params)

    const rows: SqlRow[] = []

    while (statement.step()) {
      rows.push(statement.getAsObject() as SqlRow)
    }

    statement.free()

    return rows
  }
}

function rowToSpan(row: SqlRow): SpanRecord {
  return {
    id: String(row.id),
    traceId: String(row.trace_id),
    spanId: String(row.span_id),
    parentSpanId:
      row.parent_span_id === null ? null : String(row.parent_span_id),
    name: String(row.name),
    kind: String(row.kind) as SpanRecord['kind'],
    startTime: Number(row.start_time),
    endTime: row.end_time === null ? null : Number(row.end_time),
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    status: String(row.status) as SpanRecord['status'],
    statusMessage:
      row.status_message === null ? null : String(row.status_message),
    attributes: parseJsonObject(row.attributes),
    events: parseJsonArray(row.events),
    source: String(row.source) as SpanRecord['source']
  }
}

function rowToLog(row: SqlRow): LogRecord {
  return {
    id: String(row.id),
    timestamp: Number(row.timestamp),
    level: String(row.level) as LogRecord['level'],
    message: String(row.message),
    traceId: row.trace_id === null ? null : String(row.trace_id),
    spanId: row.span_id === null ? null : String(row.span_id),
    attributes: parseJsonObject(row.attributes),
    source: String(row.source) as LogRecord['source']
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(value)

    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function parseJsonArray(value: unknown): SpanRecord['events'] {
  if (typeof value !== 'string') {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    return Array.isArray(parsed) ? (parsed as SpanRecord['events']) : []
  } catch {
    return []
  }
}

export function queryTraces(
  query: QueryFunction,
  params: QueryTracesParams
): TraceSummary[] {
  const limit = params.limit ?? defaultTraceLimit
  const conditions: string[] = []
  const bindings: Array<number | string> = []

  if (typeof params.since === 'number') {
    conditions.push('start_time >= ?')
    bindings.push(params.since)
  }

  if (params.search) {
    conditions.push('(name LIKE ? OR trace_id LIKE ?)')
    bindings.push(`%${params.search}%`, `%${params.search}%`)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const havingClause =
    params.status === 'error'
      ? 'HAVING errorCount > 0'
      : params.status === 'ok'
        ? 'HAVING errorCount = 0'
        : ''

  const rows = query(
    `SELECT
       trace_id AS traceId,
       MIN(start_time) AS startTime,
       MAX(COALESCE(end_time, start_time)) - MIN(start_time) AS durationMs,
       COUNT(*) AS spanCount,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errorCount
     FROM spans
     ${whereClause}
     GROUP BY trace_id
     ${havingClause}
     ORDER BY startTime DESC
     LIMIT ?`,
    [...bindings, limit]
  )

  const rootNames = rootNamesByTrace(
    query,
    rows.map((row) => String(row.traceId))
  )

  return rows.map((row) => {
    const traceId = String(row.traceId)
    const errorCount = Number(row.errorCount)

    return {
      traceId,
      rootName: rootNames.get(traceId) ?? 'unknown',
      startTime: Number(row.startTime),
      durationMs: Number(row.durationMs),
      spanCount: Number(row.spanCount),
      errorCount,
      status: errorCount > 0 ? 'error' : 'ok'
    }
  })
}

function rootNamesByTrace(
  query: QueryFunction,
  traceIds: string[]
): Map<string, string> {
  const names = new Map<string, string>()

  if (traceIds.length === 0) {
    return names
  }

  const placeholders = traceIds.map(() => '?').join(', ')
  const rows = query(
    `SELECT trace_id AS traceId, name, parent_span_id AS parentSpanId
     FROM spans
     WHERE trace_id IN (${placeholders})
     ORDER BY start_time ASC`,
    traceIds
  )

  for (const row of rows) {
    const traceId = String(row.traceId)

    if (row.parentSpanId === null && !names.has(traceId)) {
      names.set(traceId, String(row.name))
    }
  }

  // Fall back to the earliest span for traces with no captured root.
  for (const row of rows) {
    const traceId = String(row.traceId)

    if (!names.has(traceId)) {
      names.set(traceId, String(row.name))
    }
  }

  return names
}

export function getTrace(query: QueryFunction, traceId: string): TraceDetail {
  const spanRows = query(
    'SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time ASC',
    [traceId]
  )
  const logRows = query(
    'SELECT * FROM logs WHERE trace_id = ? ORDER BY timestamp ASC',
    [traceId]
  )

  return {
    traceId,
    spans: spanRows.map(rowToSpan),
    logs: logRows.map(rowToLog)
  }
}

export function queryLogs(
  query: QueryFunction,
  params: QueryLogsParams
): LogRecord[] {
  const limit = params.limit ?? defaultLogLimit
  const conditions: string[] = []
  const bindings: Array<number | string> = []

  if (params.level) {
    conditions.push('level = ?')
    bindings.push(params.level)
  }

  if (params.traceId) {
    conditions.push('trace_id = ?')
    bindings.push(params.traceId)
  }

  if (typeof params.since === 'number') {
    conditions.push('timestamp >= ?')
    bindings.push(params.since)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = query(
    `SELECT * FROM logs ${whereClause} ORDER BY timestamp DESC LIMIT ?`,
    [...bindings, limit]
  )

  return rows.map(rowToLog)
}

export function computeStats(query: QueryFunction): TelemetryStats {
  const traceCount = Number(
    query('SELECT COUNT(DISTINCT trace_id) AS count FROM spans')[0]?.count ?? 0
  )
  const spanCount = Number(
    query('SELECT COUNT(*) AS count FROM spans')[0]?.count ?? 0
  )
  const logCount = Number(
    query('SELECT COUNT(*) AS count FROM logs')[0]?.count ?? 0
  )
  const errorTraceCount = Number(
    query(
      "SELECT COUNT(DISTINCT trace_id) AS count FROM spans WHERE status = 'error'"
    )[0]?.count ?? 0
  )

  const durationRows = query(
    'SELECT name, duration_ms AS durationMs, status FROM spans WHERE duration_ms IS NOT NULL'
  )

  return {
    traceCount,
    spanCount,
    logCount,
    errorTraceCount,
    operations: operationStats(durationRows)
  }
}

function operationStats(rows: SqlRow[]): OperationStat[] {
  const grouped = new Map<string, { durations: number[]; errors: number }>()

  for (const row of rows) {
    const name = String(row.name)
    const entry = grouped.get(name) ?? { durations: [], errors: 0 }

    entry.durations.push(Number(row.durationMs))

    if (row.status === 'error') {
      entry.errors += 1
    }

    grouped.set(name, entry)
  }

  const operations: OperationStat[] = []

  for (const [name, entry] of grouped) {
    const sorted = [...entry.durations].sort((first, second) => first - second)

    operations.push({
      name,
      count: sorted.length,
      errorCount: entry.errors,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      maxDurationMs: sorted[sorted.length - 1] ?? 0
    })
  }

  operations.sort((first, second) => second.count - first.count)

  return operations
}

function percentile(sortedValues: number[], fraction: number): number {
  if (sortedValues.length === 0) {
    return 0
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.floor(fraction * sortedValues.length)
  )

  return sortedValues[index]
}
