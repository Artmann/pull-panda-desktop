import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createManualSpan } from './manual-span'
import type { SpanRecord } from './types'

describe('createManualSpan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('records a finished span with its attributes and status', () => {
    const records: SpanRecord[] = []
    const span = createManualSpan({
      isEnabled: () => true,
      name: 'load',
      options: {
        attributes: { route: '/home' },
        kind: 'client',
        parent: { parentSpanId: 'parent-span', traceId: 'trace-1' }
      },
      record: (record) => {
        records.push(record)
      },
      source: 'renderer'
    })

    span.setAttribute('count', 3)
    span.setStatus('error', 'Boom')
    vi.setSystemTime(1250)
    span.end()

    expect(records).toEqual([
      {
        attributes: { count: 3, route: '/home' },
        durationMs: 250,
        endTime: 1250,
        events: [],
        id: `trace-1:${span.spanId}`,
        kind: 'client',
        name: 'load',
        parentSpanId: 'parent-span',
        source: 'renderer',
        spanId: span.spanId,
        startTime: 1000,
        status: 'error',
        statusMessage: 'Boom',
        traceId: 'trace-1'
      }
    ])
  })

  it('starts a new trace when there is no parent', () => {
    const records: SpanRecord[] = []
    const span = createManualSpan({
      isEnabled: () => true,
      name: 'root',
      options: {},
      record: (record) => {
        records.push(record)
      },
      source: 'main'
    })

    span.end()

    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(records).toEqual([
      {
        attributes: {},
        durationMs: 0,
        endTime: 1000,
        events: [],
        id: `${span.traceId}:${span.spanId}`,
        kind: 'internal',
        name: 'root',
        parentSpanId: null,
        source: 'main',
        spanId: span.spanId,
        startTime: 1000,
        status: 'ok',
        statusMessage: null,
        traceId: span.traceId
      }
    ])
  })

  it('records a span only once', () => {
    const record = vi.fn()
    const span = createManualSpan({
      isEnabled: () => true,
      name: 'once',
      options: {},
      record,
      source: 'main'
    })

    span.end()
    span.end()

    expect(record).toHaveBeenCalledTimes(1)
  })

  it('does not record while disabled', () => {
    const record = vi.fn()
    const span = createManualSpan({
      isEnabled: () => false,
      name: 'disabled',
      options: {},
      record,
      source: 'renderer'
    })

    span.end()

    expect(record).not.toHaveBeenCalled()
  })
})
