import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'

import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { tasksActions } from '@/app/store/tasks-slice'
import type { Task } from '@/types/task'

interface TasksContextValue {
  hasSyncInProgress: boolean
  /** False until the first `getTasks()` IPC completes (avoids a false "empty" state). */
  tasksInitialized: boolean
  runningTasks: Task[]
  tasks: Task[]
}

const TasksContext = createContext<TasksContextValue | null>(null)

export function TasksProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const tasks = useAppSelector((state) => state.tasks.items)
  const [tasksInitialized, setTasksInitialized] = useState(false)

  useEffect(() => {
    window.electron.getTasks().then((initialTasks) => {
      dispatch(tasksActions.setTasks(initialTasks))
      setTasksInitialized(true)
    })
  }, [dispatch])

  useEffect(() => {
    const cleanup = window.electron.onTaskUpdate((event) => {
      dispatch(tasksActions.updateTask(event.task))
    })

    return cleanup
  }, [dispatch])

  const runningTasks = tasks.filter((task) => task.status === 'running')

  const hasSyncInProgress = tasks.some(
    (task) =>
      (task.status === 'running' || task.status === 'pending') &&
      (task.type === 'syncPullRequests' ||
        task.type === 'syncPullRequestDetails')
  )

  return (
    <TasksContext.Provider
      value={{ hasSyncInProgress, tasksInitialized, runningTasks, tasks }}
    >
      {children}
    </TasksContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TasksContext)

  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider')
  }

  return context
}
