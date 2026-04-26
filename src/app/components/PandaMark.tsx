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
    <span
      aria-hidden
      className={className}
      role="img"
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block'
      }}
    >
      🐼
    </span>
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
