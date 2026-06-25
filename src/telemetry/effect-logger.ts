import {
  Cause,
  Context,
  FiberId,
  FiberRef,
  FiberRefs,
  HashMap,
  Logger,
  LogLevel,
  Option,
  Tracer
} from 'effect'

import { createSpanId } from './ids'
import { getTelemetryStore } from './store'
import type { LogLevelName, LogRecord } from './types'

// A custom Effect logger that mirrors every `Effect.log*` call into the
// telemetry store, correlated with the current tracer span. It is added
// alongside the default console logger (via `Logger.add`), so existing
// terminal output is preserved.

function levelName(level: LogLevel.LogLevel): LogLevelName {
  switch (level.label) {
    case 'TRACE':
      return 'trace'
    case 'DEBUG':
      return 'debug'
    case 'WARN':
      return 'warning'
    case 'ERROR':
      return 'error'
    case 'FATAL':
      return 'fatal'
    default:
      return 'info'
  }
}

function stringifyMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message
  }

  if (Array.isArray(message)) {
    return message.map(stringifyMessage).join(' ')
  }

  if (message instanceof Error) {
    return message.message
  }

  try {
    return JSON.stringify(message)
  } catch {
    return String(message)
  }
}

function currentSpan(
  context: FiberRefs.FiberRefs
): Option.Option<Tracer.AnySpan> {
  const fiberContext = FiberRefs.getOrDefault(context, FiberRef.currentContext)

  return Context.getOption(fiberContext, Tracer.ParentSpan)
}

function annotationsToObject(
  annotations: HashMap.HashMap<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of HashMap.toEntries(annotations)) {
    result[key] = value
  }

  return result
}

export function makeTelemetryLogger(): Logger.Logger<unknown, void> {
  return Logger.make((options) => {
    const store = getTelemetryStore()

    if (!store) {
      return
    }

    const span = currentSpan(options.context)
    const attributes = annotationsToObject(options.annotations)

    if (!Cause.isEmpty(options.cause)) {
      attributes.cause = Cause.pretty(options.cause).slice(0, 2000)
    }

    const record: LogRecord = {
      id: `${options.date.getTime()}-${FiberId.threadName(options.fiberId)}-${createSpanId()}`,
      timestamp: options.date.getTime(),
      level: levelName(options.logLevel),
      message: stringifyMessage(options.message),
      traceId: Option.isSome(span) ? span.value.traceId : null,
      spanId: Option.isSome(span) ? span.value.spanId : null,
      attributes,
      source: 'main'
    }

    store.recordLogs([record])
  })
}
