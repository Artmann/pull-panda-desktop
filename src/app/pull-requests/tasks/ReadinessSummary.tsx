import { CheckCircle2Icon, AlertTriangleIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

import { ProgressRing } from './ProgressRing'

interface ReadinessSummaryProps {
  blockers: number
  done: number
  info: number
  total: number
  warnings: number
}

export function ReadinessSummary({
  blockers,
  done,
  info,
  total,
  warnings
}: ReadinessSummaryProps): ReactElement {
  const isReady = blockers === 0
  const percentage = total === 0 ? 100 : Math.round((done / total) * 100)

  const headline = isReady
    ? 'Ready to merge'
    : blockers === 1
      ? '1 blocker before this can merge'
      : `${blockers.toString()} blockers before this can merge`

  const subheadline =
    total === 0
      ? 'No tasks to resolve.'
      : `${done.toString()}/${total.toString()} resolved · ${pluralize(warnings, 'warning')} · ${info.toString()} informational`

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border p-4',
        isReady
          ? 'border-status-success-border bg-status-success-foreground/5'
          : 'border-status-danger-border bg-status-danger-foreground/5'
      )}
    >
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl',
          isReady
            ? 'bg-status-success-foreground/10 text-status-success-foreground'
            : 'bg-status-danger-foreground/10 text-status-danger-foreground'
        )}
      >
        {isReady ? (
          <CheckCircle2Icon className="size-6" />
        ) : (
          <AlertTriangleIcon className="size-6" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold tracking-tight">{headline}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {subheadline}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Stat
          count={blockers}
          label="block"
          tone="blocker"
        />
        <Stat
          count={warnings}
          label="warn"
          tone="warning"
        />
        <Stat
          count={info}
          label="info"
          tone="info"
        />
        <div className="h-9 w-px bg-border" />
        <ProgressRing percentage={percentage} />
      </div>
    </div>
  )
}

interface StatProps {
  count: number
  label: string
  tone: 'blocker' | 'warning' | 'info'
}

function Stat({ count, label, tone }: StatProps): ReactElement {
  const toneColor =
    count === 0
      ? 'text-muted-foreground'
      : tone === 'blocker'
        ? 'text-status-danger-foreground'
        : tone === 'warning'
          ? 'text-status-warning-foreground'
          : 'text-muted-foreground'

  return (
    <div className="min-w-9 text-center">
      <div
        className={cn(
          'text-lg font-semibold tabular-nums tracking-tight',
          toneColor
        )}
      >
        {count}
      </div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? `1 ${singular}` : `${count.toString()} ${singular}s`
}
