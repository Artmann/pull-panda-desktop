import { ReactElement, useMemo } from 'react'

import { useTasks } from './lib/store/tasksContext'
import { Loader2 } from 'lucide-react'

export function AppFooter(): ReactElement {
  const { tasks, runningTasks, hasSyncInProgress } = useTasks()

  console.log({ tasks, runningTasks, hasSyncInProgress })

  const currentTaskMessage = useMemo((): string | null => {
    const runningTask = runningTasks[0]

    if (!runningTask) {
      return null
    }

    return runningTask.message
  }, [runningTasks])

  return (
    <footer className="w-full bg-background flex items-center px-3 py-1 border-border border-t text-[10px]">
      <div className="flex items-center gap-1">
        {currentTaskMessage ? (
          <>
            <Loader2 className="size-3 animate-spin" /> {currentTaskMessage}
          </>
        ) : null}
      </div>
      <div>&nbsp;</div>
    </footer>
  )
}
