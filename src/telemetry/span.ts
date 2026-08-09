import { createSpanId, createTraceId } from './ids'
import { getTelemetryStore } from './store'
import {
  parentSpanIdHeader,
  traceIdHeader,
  type SpanKind,
  type SpanRecord,
  type SpanStatus,
  type TraceContext
} from './types'

// Manual span helpers for main-process code that is not built on Effect (IPC
// handlers, the Hono server). They write straight to the telemetry store and
// no-op when telemetry is disabled.

export { parentSpanIdHeader, traceIdHeader }

interface StartSpanOptions {
  attributes?: Record<string, unknown>
  kind?: SpanKind
  parent?: TraceContext | null
}

interface ManualSpan {
  readonly spanId: string
  readonly traceId: string
  end: () => void
  setAttribute: (key: string, value: unknown) => void
  setStatus: (status: SpanStatus, message?: string) => void
}

export function startSpan(
  name: string,
  options: StartSpanOptions = {}
): ManualSpan {
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
      if (ended) {
        return
      }

      ended = true

      const store = getTelemetryStore()

      if (!store) {
        return
      }

      const endTime = Date.now()
      const record: SpanRecord = {
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
        source: 'main'
      }

      store.recordSpans([record])
    }
  }
}

export async function withSpan<T>(
  name: string,
  options: StartSpanOptions,
  run: (span: ManualSpan) => Promise<T> | T
): Promise<T> {
  const span = startSpan(name, options)

  try {
    const result = await run(span)

    span.end()

    return result
  } catch (error) {
    span.setStatus(
      'error',
      error instanceof Error ? error.message : String(error)
    )
    span.end()

    throw error
  }
}

// A child span exposes its own id as the parent for downstream work, so its
// children link to it rather than to the original parent.
export function childContext(span: ManualSpan): TraceContext {
  return { traceId: span.traceId, parentSpanId: span.spanId }
}
