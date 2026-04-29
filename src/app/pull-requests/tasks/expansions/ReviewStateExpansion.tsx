import type { ReactElement } from 'react'

import type { ReviewStateTask } from '../task-types'

interface ReviewStateExpansionProps {
  task: ReviewStateTask
}

export function ReviewStateExpansion({
  task
}: ReviewStateExpansionProps): ReactElement {
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm leading-relaxed text-foreground/80">
      {task.summary}
    </div>
  )
}
