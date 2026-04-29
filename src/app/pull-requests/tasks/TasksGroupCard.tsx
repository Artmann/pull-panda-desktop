import {
  BotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListChecksIcon,
  UsersIcon
} from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { PullRequest } from '@/types/pull-request'

import { TaskRow } from './TaskRow'
import type { Task, TaskGroup, TaskGroupKey } from './task-types'

interface TasksGroupCardProps {
  group: TaskGroup
  pullRequest: PullRequest
  visibleTasks: Task[]
}

const groupIcons: Record<TaskGroupKey, typeof ListChecksIcon> = {
  agents: BotIcon,
  ci: ListChecksIcon,
  reviewers: UsersIcon
}

export function TasksGroupCard({
  group,
  pullRequest,
  visibleTasks
}: TasksGroupCardProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const counts = useMemo(() => {
    const result = { blocker: 0, done: 0, warning: 0 }

    for (const task of group.tasks) {
      if (task.severity === 'blocker') {
        result.blocker++
      } else if (task.severity === 'warning') {
        result.warning++
      } else if (task.severity === 'done') {
        result.done++
      }
    }

    return result
  }, [group.tasks])

  const Icon = groupIcons[group.key]

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        className="flex w-full cursor-pointer items-center gap-2.5 bg-muted/50 px-3.5 py-2.5 text-left"
        onClick={() => {
          setIsCollapsed((value) => !value)
        }}
        type="button"
      >
        <span className="text-muted-foreground">
          {isCollapsed ? (
            <ChevronRightIcon className="size-3.5" />
          ) : (
            <ChevronDownIcon className="size-3.5" />
          )}
        </span>

        <Icon className="size-3.5 text-muted-foreground" />

        <span className="text-sm font-semibold tracking-tight">
          {group.label}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-3 font-mono text-[11px]">
          {counts.blocker > 0 && (
            <span className="inline-flex items-center gap-1.5 text-status-danger-foreground">
              <span className="size-1.5 rounded-full bg-status-danger-foreground" />
              {counts.blocker === 1
                ? '1 blocker'
                : `${counts.blocker.toString()} blockers`}
            </span>
          )}

          {counts.warning > 0 && (
            <span className="inline-flex items-center gap-1.5 text-status-warning-foreground">
              <span className="size-1.5 rounded-full bg-status-warning-foreground" />
              {counts.warning}
            </span>
          )}

          <span className="text-muted-foreground">
            {counts.done}/{group.tasks.length}
          </span>
        </div>
      </button>

      {!isCollapsed && (
        <div>
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              defaultOpen={task.severity === 'blocker'}
              pullRequest={pullRequest}
              task={task}
            />
          ))}
        </div>
      )}
    </div>
  )
}
