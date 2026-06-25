import { Cause, Exit, Option, Tracer } from 'effect'

import { createSpanId, createTraceId } from './ids'
import { getTelemetryStore } from './store'
import type { SpanEvent, SpanRecord } from './types'

// A custom Effect tracer that records OTEL-shaped spans into the local
// telemetry store. Effect tracks the current span per fiber and passes it as
// `parent`, so parent/child relationships across fibers are captured for free
// by every `Effect.withSpan` call.

const nanosecondsPerMillisecond = 1000000n

function nanosToMillis(nanoseconds: bigint): number {
  return Number(nanoseconds / nanosecondsPerMillisecond)
}

function resolveStatus(exit: Exit.Exit<unknown, unknown>): {
  status: SpanRecord['status']
  statusMessage: string | null
} {
  if (Exit.isSuccess(exit)) {
    return { status: 'ok', statusMessage: null }
  }

  if (Cause.isInterruptedOnly(exit.cause)) {
    return { status: 'ok', statusMessage: null }
  }

  return {
    status: 'error',
    statusMessage: Cause.pretty(exit.cause).slice(0, 2000)
  }
}

export function makeTelemetryTracer(): Tracer.Tracer {
  return Tracer.make({
    span(name, parent, context, links, startTime, kind, options) {
      const traceId = Option.isSome(parent)
        ? parent.value.traceId
        : createTraceId()
      const spanId = createSpanId()
      const parentSpanId = Option.isSome(parent) ? parent.value.spanId : null

      const attributes = new Map<string, unknown>()

      if (options?.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
          attributes.set(key, value)
        }
      }

      const events: SpanEvent[] = []
      let spanLinks = [...links]
      let status: Tracer.SpanStatus = { _tag: 'Started', startTime }

      const span: Tracer.Span = {
        _tag: 'Span',
        name,
        spanId,
        traceId,
        parent,
        context,
        sampled: true,
        kind,
        get status() {
          return status
        },
        get attributes() {
          return attributes
        },
        get links() {
          return spanLinks
        },
        attribute(key, value) {
          attributes.set(key, value)
        },
        event(eventName, eventStartTime, eventAttributes) {
          events.push({
            name: eventName,
            timestamp: nanosToMillis(eventStartTime),
            attributes: eventAttributes
          })
        },
        addLinks(additionalLinks) {
          spanLinks = [...spanLinks, ...additionalLinks]
        },
        end(endTime, exit) {
          status = { _tag: 'Ended', startTime, endTime, exit }

          const store = getTelemetryStore()

          if (!store) {
            return
          }

          const resolved = resolveStatus(exit)
          const record: SpanRecord = {
            id: `${traceId}:${spanId}`,
            traceId,
            spanId,
            parentSpanId,
            name,
            kind,
            startTime: nanosToMillis(startTime),
            endTime: nanosToMillis(endTime),
            durationMs: nanosToMillis(endTime - startTime),
            status: resolved.status,
            statusMessage: resolved.statusMessage,
            attributes: Object.fromEntries(attributes),
            events,
            source: 'main'
          }

          store.recordSpans([record])
        }
      }

      return span
    },

    context(execute) {
      return execute()
    }
  })
}
