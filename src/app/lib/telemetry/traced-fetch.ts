import { parentSpanIdHeader, traceIdHeader } from '@/telemetry/types'

import { startSpan } from './tracer'

// Drop-in replacement for `fetch` used by the renderer API client. It opens a
// client span for the request and injects the trace context headers so the
// local API server (and the Effect work it triggers) join the same trace.

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

export async function tracedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const span = startSpan(`fetch ${method} ${pathOf(input)}`, {
    kind: 'client',
    attributes: { 'http.method': method, 'http.url': input }
  })

  const headers = new Headers(init.headers)

  headers.set(traceIdHeader, span.traceId)
  headers.set(parentSpanIdHeader, span.spanId)

  try {
    const response = await fetch(input, { ...init, headers })

    span.setAttribute('http.status', response.status)

    if (!response.ok) {
      span.setStatus('error', `HTTP ${response.status}`)
    }

    span.end()

    return response
  } catch (error) {
    span.setStatus(
      'error',
      error instanceof Error ? error.message : String(error)
    )
    span.end()

    throw error
  }
}
