import { createSpanId, createTraceId } from '@/telemetry/ids'
import type {
  LogRecord,
  SpanKind,
  SpanRecord,
  SpanStatus,
  TraceContext
} from '@/telemetry/types'

// Renderer-side tracer. It produces OTEL-shaped spans in the renderer, buffers
// them, and ships batches to the main process over IPC, where they land in the
// shared telemetry store. It has no database access of its own and no-ops until
// `initializeRendererTelemetry` confirms telemetry is enabled (dev only).

const flushIntervalMilliseconds = 2000
const flushBatchThreshold = 100

let enabled = false
const spanBuffer: SpanRecord[] = []
const logBuffer: LogRecord[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

interface StartSpanOptions {
  attributes?: Record<string, unknown>
  kind?: SpanKind
  parent?: TraceContext | null
}

interface RendererSpan {
  readonly spanId: string
  readonly traceId: string
  end: () => void
  setAttribute: (key: string, value: unknown) => void
  setStatus: (status: SpanStatus, message?: string) => void
}

export async function initializeRendererTelemetry(): Promise<void> {
  // `window.telemetry` is only present when the preload bridge is loaded (the
  // real app), not in unit tests that render components directly.
  if (!window.telemetry) {
    return
  }

  enabled = await window.telemetry.isEnabled()

  if (enabled) {
    window.addEventListener('pagehide', flush)
  }
}

export function startSpan(
  name: string,
  options: StartSpanOptions = {}
): RendererSpan {
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
      if (ended || !enabled) {
        return
      }

      ended = true

      const endTime = Date.now()

      spanBuffer.push({
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
        source: 'renderer'
      })

      scheduleFlush()
    }
  }
}

function scheduleFlush(): void {
  if (spanBuffer.length + logBuffer.length >= flushBatchThreshold) {
    flush()

    return
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flush, flushIntervalMilliseconds)
  }
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  if (spanBuffer.length === 0 && logBuffer.length === 0) {
    return
  }

  const batch = {
    spans: spanBuffer.splice(0, spanBuffer.length),
    logs: logBuffer.splice(0, logBuffer.length)
  }

  window.telemetry.record(batch).catch(() => {
    // Telemetry is best-effort; dropping a batch must never disrupt the UI.
  })
}
