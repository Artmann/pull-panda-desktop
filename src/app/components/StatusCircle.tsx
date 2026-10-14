import { CheckIcon, XIcon } from 'lucide-react'
import { memo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

export type StatusCircleState =
  | 'failure'
  | 'neutral'
  | 'running'
  | 'success'
  | 'warning'

/**
 * The status mark shared by the Tasks and Checks rows. Finished states are
 * filled so they read at a glance; anything still waiting on someone is an
 * outline, which keeps a column of mostly-done rows quiet.
 */
export const StatusCircle = memo(function StatusCircle({
  className,
  label,
  state
}: {
  className?: string
  label?: string
  state: StatusCircleState
}): ReactElement {
  return (
    <span
      aria-label={label}
      className={cn(
        'flex size-4.5 shrink-0 items-center justify-center rounded-full border-[1.5px]',
        stateClassNames[state],
        className
      )}
      role={label ? 'img' : undefined}
    >
      {state === 'success' && (
        <CheckIcon
          className="size-2.5"
          strokeWidth={3.5}
        />
      )}

      {state === 'failure' && (
        <XIcon
          className="size-2.5"
          strokeWidth={3.5}
        />
      )}

      {state === 'running' && (
        <span className="size-1 rounded-full bg-status-warning-foreground" />
      )}

      {state === 'warning' && (
        <span className="text-2xs leading-none font-bold">!</span>
      )}
    </span>
  )
})

const stateClassNames: Record<StatusCircleState, string> = {
  failure:
    'border-status-danger-foreground bg-status-danger-foreground text-background',
  neutral: 'border-muted-foreground/60',
  running: 'border-status-warning-foreground',
  success:
    'border-status-success-foreground bg-status-success-foreground text-background',
  warning: 'border-status-warning-foreground text-status-warning-foreground'
}
