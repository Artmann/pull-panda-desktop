import type { ReactElement } from 'react'

import type { ReviewStateTask } from '../task-types'

interface ReviewStateExpansionProps {
  task: ReviewStateTask
}

export function ReviewStateExpansion({
  task
}: ReviewStateExpansionProps): ReactElement {
  return (
    <div className="text-xs leading-relaxed text-muted-foreground">
      {task.summary}
    </div>
  )
}
