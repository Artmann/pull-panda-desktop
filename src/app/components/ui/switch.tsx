import * as React from 'react'

import { cn } from '@/app/lib/utils'

interface SwitchProps extends Omit<React.ComponentProps<'button'>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export function Switch({
  checked = false,
  className,
  disabled,
  onCheckedChange,
  ...props
}: SwitchProps): React.ReactElement {
  return (
    <button
      aria-checked={checked}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        className
      )}
      disabled={disabled}
      onClick={() => {
        onCheckedChange?.(!checked)
      }}
      role="switch"
      type="button"
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}
