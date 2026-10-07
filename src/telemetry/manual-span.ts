import { createSpanId, createTraceId } from './ids'
import type { SpanKind, SpanRecord, SpanStatus, TraceContext } from './types'

// Process-agnostic span builder shared by the main-process span helpers and the
// renderer tracer. It holds no store or IPC dependency of its own: callers
// decide whether a finished span is recorded and where it goes.

export interface StartSpanOptions {
  attributes?: Record<string, unknown>
  kind?: SpanKind
  parent?: TraceContext | null
}

export interface ManualSpan {
  readonly spanId: string
  readonly traceId: string
  end: () => void
  setAttribute: (key: string, value: unknown) => void
  setStatus: (status: SpanStatus, message?: string) => void
}

interface CreateManualSpanOptions {
  isEnabled: () => boolean
  name: string
  options: StartSpanOptions
  record: (span: SpanRecord) => void
  source: SpanRecord['source']
}

export function createManualSpan({
  isEnabled,
  name,
  options,
  record,
  source
}: CreateManualSpanOptions): ManualSpan {
  const parent = options.parent ?? null
  const traceId = parent ? parent.traceId : createTraceId()
  const spanId = createSpanId()
  const parentSpanId = parent ? parent.parentSpanId : null
  const startTime = Date.now()
  const attributes: Record<string, unknown> = { ...options.attributes }

  let status: SpanStatus = 'ok'
  let statusMessage: string | null = null
  let ended = false

  return {
    traceId,
    spanId,
    setAttribute: (key, value) => {
      attributes[key] = value
    },
    setStatus: (nextStatus, message) => {
      status = nextStatus
      statusMessage = message ?? null
    },
    end: () => {
      if (ended || !isEnabled()) {
        return
      }

      ended = true

      const endTime = Date.now()

      record({
        id: `${traceId}:${spanId}`,
        traceId,
        spanId,
        parentSpanId,
        name,
        kind: options.kind ?? 'internal',
        startTime,
        endTime,
        durationMs: endTime - startTime,
        status,
        statusMessage,
        attributes,
        events: [],
        source
      })
    }
  }
}
