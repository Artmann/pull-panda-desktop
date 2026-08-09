import { ReactElement, useMemo } from 'react'
import { Loader2 } from 'lucide-react'

import { useAuth } from './lib/store/authContext'
import { useTasks } from './lib/store/tasksContext'

// Pages portal contextual actions (e.g. the pull request toolbar) into this
// element so they live in the footer instead of floating over the content.
export const appFooterActionsSlotId = 'app-footer-actions'

export function AppFooter(): ReactElement {
  const { runningTasks } = useTasks()
  const { user } = useAuth()

  const currentTaskMessage = useMemo((): string | null => {
    const runningTask = runningTasks[0]

    if (!runningTask) {
      return null
    }

    return runningTask.message
  }, [runningTasks])

  const isBusy = currentTaskMessage !== null

  return (
    <footer
      className="
        w-full bg-titlebar border-t border-border
        flex items-center gap-4 px-4 h-12
        font-mono text-[10px] text-muted-foreground
        select-none
      "
    >
      {user?.login ? <span>{user.login}</span> : null}

      <div className="flex items-center gap-1.5">
        {isBusy ? (
          <>
            <Loader2 className="size-2.5 animate-spin" />
            <span>{currentTaskMessage}</span>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-primary"
            />
            <span>Synchronized · pull requests</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      <div
        className="flex items-center gap-2"
        id={appFooterActionsSlotId}
      />
    </footer>
  )
}
