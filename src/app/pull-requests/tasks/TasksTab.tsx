import { CheckCircle2Icon } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { PullRequest } from '@/types/pull-request'

import { ReadinessSummary } from './ReadinessSummary'
import { TasksFilterBar } from './TasksFilterBar'
import { TasksGroupCard } from './TasksGroupCard'
import { useDerivedTaskGroups } from './use-derived-tasks'
import type { Task, TasksFilter } from './task-types'

interface TasksTabProps {
  pullRequest: PullRequest
}

export function TasksTab({ pullRequest }: TasksTabProps): ReactElement {
  const groups = useDerivedTaskGroups(pullRequest.id)

  const [filter, setFilter] = useState<TasksFilter>('all')
  const [hideResolved, setHideResolved] = useState(false)

  const allTasks = useMemo(
    () => groups.flatMap((group) => group.tasks),
    [groups]
  )

  const blockers = allTasks.filter((task) => task.severity === 'blocker').length
  const warnings = allTasks.filter((task) => task.severity === 'warning').length
  const info = allTasks.filter((task) => task.severity === 'info').length
  const done = allTasks.filter((task) => task.severity === 'done').length

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => {
        const tasks = group.tasks.filter((task) =>
          isVisible(task, filter, hideResolved)
        )

        return { ...group, visibleTasks: tasks }
      })
      .filter((group) => group.visibleTasks.length > 0)
  }, [groups, filter, hideResolved])

  return (
    <div className="flex flex-col gap-4 py-4">
      <ReadinessSummary
        blockers={blockers}
        done={done}
        info={info}
        total={allTasks.length}
        warnings={warnings}
      />

      <TasksFilterBar
        filter={filter}
        hideResolved={hideResolved}
        onChangeFilter={setFilter}
        onToggleHideResolved={() => {
          setHideResolved((value) => !value)
        }}
      />

      {filteredGroups.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filteredGroups.map((group) => (
            <TasksGroupCard
              key={group.key}
              group={group}
              pullRequest={pullRequest}
              visibleTasks={group.visibleTasks}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          filter={filter}
          hideResolved={hideResolved}
          totalTasks={allTasks.length}
        />
      )}

      <div className="pt-2 text-center font-mono text-[11px] text-muted-foreground">
        Tasks update live as checks finish, reviews land, and threads resolve.
      </div>
    </div>
  )
}

interface EmptyStateProps {
  filter: TasksFilter
  hideResolved: boolean
  totalTasks: number
}

function EmptyState({
  filter,
  hideResolved,
  totalTasks
}: EmptyStateProps): ReactElement {
  const isFiltered = filter !== 'all' || hideResolved
  const message =
    totalTasks === 0
      ? 'Nothing to do here. This PR is ready.'
      : isFiltered
        ? 'No tasks match the current filter.'
        : 'All tasks are resolved.'

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <CheckCircle2Icon className="size-6 text-status-success-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function isVisible(
  task: Task,
  filter: TasksFilter,
  hideResolved: boolean
): boolean {
  if (hideResolved && task.severity === 'done') {
    return false
  }

  if (filter === 'blockers') {
    return task.severity === 'blocker'
  }

  if (filter === 'open') {
    return task.severity !== 'done'
  }

  return true
}
