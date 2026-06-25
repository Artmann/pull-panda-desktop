// Shared telemetry data model. These OTEL-shaped records flow from the Effect
// tracer/logger (main process) and the renderer tracer, over IPC, into the
// telemetry store, and back out to the dashboard and the `inspect-traces` CLI.

type SpanSource = 'main' | 'renderer'

export type SpanKind =
  | 'consumer'
  | 'client'
  | 'internal'
  | 'producer'
  | 'server'

export type SpanStatus = 'error' | 'ok' | 'unset'

export type LogLevelName =
  | 'debug'
  | 'error'
  | 'fatal'
  | 'info'
  | 'trace'
  | 'warning'

export interface SpanEvent {
  attributes?: Record<string, unknown>
  name: string
  timestamp: number
}

export interface SpanRecord {
  attributes: Record<string, unknown>
  durationMs: number | null
  endTime: number | null
  events: SpanEvent[]
  id: string
  kind: SpanKind
  name: string
  parentSpanId: string | null
  source: SpanSource
  spanId: string
  startTime: number
  status: SpanStatus
  statusMessage: string | null
  traceId: string
}

export interface LogRecord {
  attributes: Record<string, unknown>
  id: string
  level: LogLevelName
  message: string
  source: SpanSource
  spanId: string | null
  timestamp: number
  traceId: string | null
}

// Trace context propagated across the IPC and HTTP boundaries so a
// renderer-initiated action and the main-process work it triggers end up in a
// single trace tree.

export interface TraceContext {
  parentSpanId: string
  traceId: string
}

// HTTP headers used to carry trace context from the renderer to the local API
// server. Defined here (rather than in `span.ts`) so the renderer can import
// them without pulling in main-process-only code.
export const traceIdHeader = 'x-trace-id'
export const parentSpanIdHeader = 'x-parent-span-id'

export interface TraceSummary {
  durationMs: number
  errorCount: number
  rootName: string
  spanCount: number
  startTime: number
  status: SpanStatus
  traceId: string
}

export interface TraceDetail {
  logs: LogRecord[]
  spans: SpanRecord[]
  traceId: string
}

export interface OperationStat {
  count: number
  errorCount: number
  maxDurationMs: number
  name: string
  p50Ms: number
  p95Ms: number
}

export interface TelemetryStats {
  errorTraceCount: number
  logCount: number
  operations: OperationStat[]
  spanCount: number
  traceCount: number
}

export interface QueryTracesParams {
  limit?: number
  search?: string
  since?: number
  status?: 'all' | 'error' | 'ok'
}

export interface QueryLogsParams {
  level?: LogLevelName
  limit?: number
  since?: number
  traceId?: string
}

// The renderer ships batches of both record kinds in a single IPC call.

export interface TelemetryBatch {
  logs: LogRecord[]
  spans: SpanRecord[]
}
