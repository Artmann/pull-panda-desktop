import type { ReactElement } from 'react'

import type { ReviewStateTask } from '../task-types'

interface ReviewStateExpansionProps {
  task: ReviewStateTask
}

export function ReviewStateExpansion({
  task
}: ReviewStateExpansionProps): ReactElement {
  return (
    <div className="text-sm leading-relaxed text-foreground/80">
      {task.summary}
    </div>
  )
}
