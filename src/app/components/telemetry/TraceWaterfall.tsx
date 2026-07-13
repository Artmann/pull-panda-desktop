import { type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'
import { spanDepths } from '@/telemetry/queries'
import type { SpanRecord } from '@/telemetry/types'

interface TraceWaterfallProps {
  spans: SpanRecord[]
}

interface PositionedSpan {
  depth: number
  leftPercent: number
  span: SpanRecord
  widthPercent: number
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) {
    return '—'
  }

  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  return `${(milliseconds / 1000).toFixed(2)}s`
}

function positionSpans(spans: SpanRecord[]): PositionedSpan[] {
  if (spans.length === 0) {
    return []
  }

  const traceStart = Math.min(...spans.map((span) => span.startTime))
  const traceEnd = Math.max(
    ...spans.map((span) => span.endTime ?? span.startTime)
  )
  const total = Math.max(1, traceEnd - traceStart)
  const depthOf = spanDepths(spans)

  return spans.map((span) => {
    const duration = span.durationMs ?? 0

    return {
      span,
      depth: depthOf.get(span.spanId) ?? 0,
      leftPercent: ((span.startTime - traceStart) / total) * 100,
      widthPercent: Math.max(1, (duration / total) * 100)
    }
  })
}

function barColor(span: SpanRecord): string {
  if (span.status === 'error') {
    return 'bg-destructive'
  }

  return span.source === 'renderer' ? 'bg-chart-5' : 'bg-chart-2'
}

export function TraceWaterfall({ spans }: TraceWaterfallProps): ReactElement {
  if (spans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No spans in this trace.
      </div>
    )
  }

  const positioned = positionSpans(spans)

  return (
    <div className="space-y-1">
      {positioned.map(({ span, depth, leftPercent, widthPercent }) => (
        <div
          key={span.id}
          className="grid grid-cols-[16rem_1fr] items-center gap-3 text-xs"
        >
          <div
            className="truncate"
            style={{ paddingLeft: `${depth * 12}px` }}
            title={span.name}
          >
            <span className="font-medium">{span.name}</span>
          </div>

          <div className="relative h-5 rounded bg-muted/50">
            <div
              className={cn(
                'absolute top-0 h-5 rounded',
                barColor(span)
              )}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                minWidth: '2px'
              }}
              title={span.statusMessage ?? span.name}
            />
            <span className="absolute right-1 top-0 leading-5 text-muted-foreground">
              {formatDuration(span.durationMs)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
