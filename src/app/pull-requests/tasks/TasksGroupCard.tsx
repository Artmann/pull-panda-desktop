import type { ReactElement } from 'react'

import type { PullRequest } from '@/types/pull-request'

import { ReviewerBar } from '../ReviewerBar'
import { TaskRow } from './TaskRow'
import type { Task, TaskGroup } from './task-types'

interface TasksGroupCardProps {
  group: TaskGroup
  pullRequest: PullRequest
  visibleTasks: Task[]
}

export function TasksGroupCard({
  group,
  pullRequest,
  visibleTasks
}: TasksGroupCardProps): ReactElement {
  const doneCount = group.tasks.filter(
    (task) => task.severity === 'done'
  ).length

  // Who is reviewing, and the picker to add more, sit on the Reviews header.
  // With nobody assigned, the "No review required" row carries the picker
  // instead, so it is not shown twice.
  const showReviewers =
    group.key === 'reviews' &&
    !group.tasks.some((task) => task.action?.type === 'assign-reviewers')

  return (
    <section
      aria-label={group.label}
      className="flex flex-col"
    >
      <div className="flex min-h-7 items-center justify-between gap-3 px-0.5 pb-2 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        <h3>{group.label}</h3>

        <div className="flex items-center gap-3">
          {showReviewers && <ReviewerBar pullRequest={pullRequest} />}

          <span className="tabular-nums">
            {doneCount}/{group.tasks.length}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {visibleTasks.map((task) => (
          <TaskRow
            key={task.id}
            pullRequest={pullRequest}
            task={task}
          />
        ))}
      </div>
    </section>
  )
}
