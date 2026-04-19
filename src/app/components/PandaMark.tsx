import { type ReactElement } from 'react'

interface PandaMarkProps {
  className?: string
  size?: number
}

export function PandaMark({
  className,
  size = 18
}: PandaMarkProps): ReactElement {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <circle cx="6.5" cy="7" fill="currentColor" r="3" />
      <circle cx="17.5" cy="7" fill="currentColor" r="3" />
      <circle cx="12" cy="13" fill="currentColor" r="7" />
      <circle cx="9.3" cy="12" fill="var(--titlebar)" r="1.6" />
      <circle cx="14.7" cy="12" fill="var(--titlebar)" r="1.6" />
      <circle cx="9.3" cy="12" fill="currentColor" r="0.7" />
      <circle cx="14.7" cy="12" fill="currentColor" r="0.7" />
    </svg>
  )
}

export function Wordmark({
  className
}: {
  className?: string
}): ReactElement {
  return (
    <div
      className={
        'flex items-center gap-2 text-foreground select-none ' +
        (className ?? '')
      }
    >
      <PandaMark size={16} />
      <span
        className="text-xs font-bold tracking-tight"
        style={{ letterSpacing: '-0.01em' }}
      >
        pullpanda
      </span>
    </div>
  )
}
