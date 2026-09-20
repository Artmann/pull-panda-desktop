import { type ReactElement, type ReactNode } from 'react'

import { isMac } from '@/app/commands/utils'
import { cn } from '@/app/lib/utils'

/**
 * One key of a keyboard shortcut, drawn as a keycap.
 *
 * The colours are the ones a keycap wants on the app's own surfaces; on a
 * tooltip, which paints `background` on `foreground`, pass those in through
 * `className`.
 */
export function Kbd({
  children,
  className
}: {
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <kbd
      className={cn(
        'border-border text-muted-foreground inline-flex items-center rounded-sm border',
        'px-1.5 py-0.5 text-2xs leading-none tabular-nums uppercase whitespace-nowrap',
        className
      )}
    >
      {children}
    </kbd>
  )
}

/** The platform's command modifier, as it is printed on the key. */
export function modifierKey(): string {
  return isMac() ? '⌘' : 'Ctrl'
}

/** A modifier and a key as one chord. */
export function shortcutLabel(key: string): string {
  // ⌘1 reads as a single chord; Ctrl1 does not, so off the Mac it needs the
  // plus to be legible at all.
  return isMac() ? `${modifierKey()}${key}` : `${modifierKey()}+${key}`
}
