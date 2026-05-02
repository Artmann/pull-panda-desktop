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

  const counts = useMemo(() => {
    const result = { blockers: 0, done: 0, info: 0, warnings: 0 }

    for (const task of allTasks) {
      if (task.severity === 'blocker') {
        result.blockers++
      } else if (task.severity === 'warning') {
        result.warnings++
      } else if (task.severity === 'info') {
        result.info++
      } else if (task.severity === 'done') {
        result.done++
      }
    }

    return result
  }, [allTasks])

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
        blockers={counts.blockers}
        done={counts.done}
        info={counts.info}
        total={allTasks.length}
        warnings={counts.warnings}
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
