import {
  BotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListChecksIcon,
  UsersIcon
} from 'lucide-react'
import { useState, type ReactElement } from 'react'

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

  const blockerCount = group.tasks.filter(
    (task) => task.severity === 'blocker'
  ).length
  const warningCount = group.tasks.filter(
    (task) => task.severity === 'warning'
  ).length
  const doneCount = group.tasks.filter(
    (task) => task.severity === 'done'
  ).length

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
          {blockerCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-status-danger-foreground">
              <span className="size-1.5 rounded-full bg-status-danger-foreground" />
              {blockerCount === 1
                ? '1 blocker'
                : `${blockerCount.toString()} blockers`}
            </span>
          )}

          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-status-warning-foreground">
              <span className="size-1.5 rounded-full bg-status-warning-foreground" />
              {warningCount}
            </span>
          )}

          <span className="text-muted-foreground">
            {doneCount}/{group.tasks.length}
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
