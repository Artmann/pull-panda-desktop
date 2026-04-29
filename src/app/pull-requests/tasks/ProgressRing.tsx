import type { ReactElement } from 'react'

interface ProgressRingProps {
  percentage: number
}

export function ProgressRing({ percentage }: ProgressRingProps): ReactElement {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)))
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative size-10 shrink-0">
      <svg
        className="-rotate-90"
        height="40"
        viewBox="0 0 40 40"
        width="40"
      >
        <circle
          cx="20"
          cy="20"
          fill="none"
          r={radius}
          stroke="var(--border)"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          fill="none"
          r={radius}
          stroke="var(--status-success-foreground)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-semibold tracking-tight text-muted-foreground">
        {clamped}%
      </div>
    </div>
  )
}
