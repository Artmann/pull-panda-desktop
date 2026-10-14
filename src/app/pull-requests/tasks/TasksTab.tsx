import { CheckCircle2Icon } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { PullRequest } from '@/types/pull-request'

import { TasksFilterBar } from './TasksFilterBar'
import { TasksGroupCard } from './TasksGroupCard'
import { useDerivedTaskGroups } from './use-derived-tasks'
import type { Task, TasksFilter } from './task-types'

interface TasksTabProps {
  pullRequest: PullRequest
}

export function TasksTab({ pullRequest }: TasksTabProps): ReactElement {
  const groups = useDerivedTaskGroups(pullRequest)

  const [filter, setFilter] = useState<TasksFilter>('all')

  const allTasks = useMemo(
    () => groups.flatMap((group) => group.tasks),
    [groups]
  )

  const doneCount = allTasks.filter((task) => task.severity === 'done').length

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => {
        const tasks = group.tasks.filter((task) => isVisible(task, filter))

        return { ...group, visibleTasks: tasks }
      })
      .filter((group) => group.visibleTasks.length > 0)
  }, [groups, filter])

  return (
    <div className="flex flex-col gap-4 pt-5 pb-4">
      <TasksFilterBar
        doneCount={doneCount}
        filter={filter}
        onChangeFilter={setFilter}
        totalCount={allTasks.length}
      />

      {filteredGroups.length > 0 ? (
        <div className="flex flex-col gap-7">
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
        <EmptyState filter={filter} />
      )}
    </div>
  )
}

function EmptyState({ filter }: { filter: TasksFilter }): ReactElement {
  const message =
    filter === 'blockers'
      ? 'Nothing is blocking this pull request.'
      : 'Nothing left to do.'

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <CheckCircle2Icon className="size-6 text-status-success-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function isVisible(task: Task, filter: TasksFilter): boolean {
  if (filter === 'blockers') {
    return task.severity === 'blocker'
  }

  if (filter === 'open') {
    return task.severity !== 'done'
  }

  return true
}
