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

interface WordmarkProps {
  className?: string
  title?: string
}

export function Wordmark({
  className,
  title = 'Pull Panda'
}: WordmarkProps): ReactElement {
  return (
    <div
      className={
        'flex min-w-0 items-center text-foreground select-none ' +
        (className ?? '')
      }
    >
      <span
        className="truncate text-xs font-bold tracking-tight"
        style={{ letterSpacing: '-0.01em' }}
      >
        {title}
      </span>
    </div>
  )
}
