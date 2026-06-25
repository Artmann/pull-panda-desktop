import fs from 'node:fs'
import path from 'node:path'

import initSqlJs, { type Database } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  computeStats,
  createQueryFunction,
  getTrace,
  queryLogs,
  queryTraces,
  type QueryFunction
} from './queries'

let sqlReady: Awaited<ReturnType<typeof initSqlJs>>

beforeAll(async () => {
  const wasmPath = path.join(
    process.cwd(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  )
  const wasmBuffer = fs.readFileSync(wasmPath)

  sqlReady = await initSqlJs({
    wasmBinary: wasmBuffer.buffer.slice(
      wasmBuffer.byteOffset,
      wasmBuffer.byteOffset + wasmBuffer.byteLength
    ) as ArrayBuffer
  })
})

const base = 1_700_000_000_000

function makeDatabase(): { query: QueryFunction; sqlite: Database } {
  const sqlite = new sqlReady.Database()

  sqlite.run(`
    CREATE TABLE spans (
      id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, span_id TEXT NOT NULL,
      parent_span_id TEXT, name TEXT NOT NULL, kind TEXT NOT NULL,
      start_time INTEGER NOT NULL, end_time INTEGER, duration_ms INTEGER,
      status TEXT NOT NULL, status_message TEXT, attributes TEXT NOT NULL,
      events TEXT NOT NULL, source TEXT NOT NULL
    );
    CREATE TABLE logs (
      id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, level TEXT NOT NULL,
      message TEXT NOT NULL, trace_id TEXT, span_id TEXT,
      attributes TEXT NOT NULL, source TEXT NOT NULL
    );
  `)

  const insertSpan = (values: Array<number | string | null>) => {
    sqlite.run(`INSERT INTO spans VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, values)
  }

  // Trace 1: a renderer -> server chain, all ok.
  insertSpan(['t1:r', 't1', 'r', null, 'fetch /api', 'client', base, base + 100, 100, 'ok', null, '{}', '[]', 'renderer']) // prettier-ignore
  insertSpan(['t1:s', 't1', 's', 'r', 'http /api', 'server', base + 5, base + 90, 85, 'ok', null, '{"http.path":"/api"}', '[]', 'main']) // prettier-ignore

  // Trace 2 (newer): a background sync with an error.
  insertSpan(['t2:a', 't2', 'a', null, 'sync.details', 'internal', base + 1000, base + 1300, 300, 'error', 'boom', '{}', '[]', 'main']) // prettier-ignore
  insertSpan(['t2:b', 't2', 'b', 'a', 'sync.checks', 'internal', base + 1010, base + 1130, 120, 'ok', null, '{}', '[]', 'main']) // prettier-ignore

  sqlite.run(`INSERT INTO logs VALUES (?,?,?,?,?,?,?,?)`, [
    'log1',
    base + 1015,
    'error',
    'checks failed',
    't2',
    'b',
    '{}',
    'main'
  ])

  const query: QueryFunction = createQueryFunction(sqlite)

  return { query, sqlite }
}

describe('queryTraces', () => {
  it('summarizes traces newest first with root name and error status', () => {
    const { query } = makeDatabase()

    const traces = queryTraces(query, {})

    expect(traces).toEqual([
      {
        traceId: 't2',
        rootName: 'sync.details',
        startTime: base + 1000,
        durationMs: 300,
        spanCount: 2,
        errorCount: 1,
        status: 'error'
      },
      {
        traceId: 't1',
        rootName: 'fetch /api',
        startTime: base,
        durationMs: 100,
        spanCount: 2,
        errorCount: 0,
        status: 'ok'
      }
    ])
  })

  it('filters to error traces only', () => {
    const { query } = makeDatabase()

    const traces = queryTraces(query, { status: 'error' })

    expect(traces.map((trace) => trace.traceId)).toEqual(['t2'])
  })

  it('filters by operation name search', () => {
    const { query } = makeDatabase()

    const traces = queryTraces(query, { search: 'fetch' })

    expect(traces.map((trace) => trace.traceId)).toEqual(['t1'])
  })

  it('bounds results by since timestamp', () => {
    const { query } = makeDatabase()

    const traces = queryTraces(query, { since: base + 500 })

    expect(traces.map((trace) => trace.traceId)).toEqual(['t2'])
  })
})

describe('getTrace', () => {
  it('returns the spans and correlated logs for a trace', () => {
    const { query } = makeDatabase()

    const detail = getTrace(query, 't2')

    expect(detail.traceId).toEqual('t2')
    expect(detail.spans.map((span) => span.spanId)).toEqual(['a', 'b'])
    expect(detail.logs).toEqual([
      {
        id: 'log1',
        timestamp: base + 1015,
        level: 'error',
        message: 'checks failed',
        traceId: 't2',
        spanId: 'b',
        attributes: {},
        source: 'main'
      }
    ])
  })

  it('parses span attributes from stored JSON', () => {
    const { query } = makeDatabase()

    const detail = getTrace(query, 't1')
    const serverSpan = detail.spans.find((span) => span.spanId === 's')

    expect(serverSpan?.attributes).toEqual({ 'http.path': '/api' })
  })
})

describe('queryLogs', () => {
  it('filters logs by level', () => {
    const { query } = makeDatabase()

    expect(queryLogs(query, { level: 'error' })).toHaveLength(1)
    expect(queryLogs(query, { level: 'info' })).toEqual([])
  })
})

describe('computeStats', () => {
  it('aggregates counts and per-operation percentiles', () => {
    const { query } = makeDatabase()

    const stats = computeStats(query)

    expect(stats.traceCount).toEqual(2)
    expect(stats.spanCount).toEqual(4)
    expect(stats.logCount).toEqual(1)
    expect(stats.errorTraceCount).toEqual(1)

    const details = stats.operations.find(
      (operation) => operation.name === 'sync.details'
    )

    expect(details).toEqual({
      name: 'sync.details',
      count: 1,
      errorCount: 1,
      p50Ms: 300,
      p95Ms: 300,
      maxDurationMs: 300
    })
  })
})
