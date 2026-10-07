import {
  createManualSpan,
  type ManualSpan,
  type StartSpanOptions
} from './manual-span'
import { getTelemetryStore } from './store'
import { parentSpanIdHeader, traceIdHeader, type TraceContext } from './types'

// Manual span helpers for main-process code that is not built on Effect (IPC
// handlers, the Hono server). They write straight to the telemetry store and
// no-op when telemetry is disabled.

export { parentSpanIdHeader, traceIdHeader }

export function startSpan(
  name: string,
  options: StartSpanOptions = {}
): ManualSpan {
  return createManualSpan({
    isEnabled: () => true,
    name,
    options,
    record: (record) => {
      getTelemetryStore()?.recordSpans([record])
    },
    source: 'main'
  })
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
