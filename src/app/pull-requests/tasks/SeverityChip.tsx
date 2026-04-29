import type { ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

import type { Severity } from './task-types'

interface SeverityChipProps {
  severity: Severity
}

const severityClassNames: Record<Severity, string> = {
  blocker:
    'text-status-danger-foreground border-status-danger-border bg-status-danger-foreground/10',
  done: 'text-status-success-foreground border-status-success-border bg-transparent',
  info: 'text-muted-foreground border-border bg-transparent',
  warning:
    'text-status-warning-foreground border-status-warning-border bg-status-warning-foreground/10'
}

const severityLabels: Record<Severity, string> = {
  blocker: 'Blocker',
  done: 'Done',
  info: 'Info',
  warning: 'Warning'
}

export function SeverityChip({ severity }: SeverityChipProps): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
        'text-[10px] font-mono font-semibold uppercase tracking-wider',
        'border whitespace-nowrap shrink-0',
        severityClassNames[severity]
      )}
    >
      {severityLabels[severity]}
    </span>
  )
}
