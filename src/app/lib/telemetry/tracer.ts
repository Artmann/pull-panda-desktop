import {
  createManualSpan,
  type ManualSpan,
  type StartSpanOptions
} from '@/telemetry/manual-span'
import type { LogRecord, SpanRecord } from '@/telemetry/types'

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
): ManualSpan {
  return createManualSpan({
    isEnabled: () => enabled,
    name,
    options,
    record: (record) => {
      spanBuffer.push(record)
      scheduleFlush()
    },
    source: 'renderer'
  })
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
