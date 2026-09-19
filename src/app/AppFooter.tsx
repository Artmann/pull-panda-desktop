import { ReactElement, useMemo } from 'react'
import { Loader2 } from 'lucide-react'

import { useCommandContext } from './commands/context'
import { useAuth } from './lib/store/authContext'
import { useTasks } from './lib/store/tasksContext'
import { PullRequestFooterActions } from './pull-requests/PullRequestFooterActions'

// The bottom bar owns the pull request actions, so it keeps a constant height
// on every route: the action slot is simply empty away from a pull request,
// and navigating never resizes the content area underneath. Its height is
// mirrored by `--spacing-footer`, which viewport-anchored overlays use to stop
// above the bar instead of covering it.
export function AppFooter(): ReactElement {
  const { runningTasks } = useTasks()
  const { user } = useAuth()
  const { context } = useCommandContext()

  const currentTaskMessage = useMemo((): string | null => {
    const runningTask = runningTasks[0]

    if (!runningTask) {
      return null
    }

    // A running task without a message still means we are busy, so fall back to
    // a label rather than rendering a spinner with nothing beside it.
    return runningTask.message ?? 'Working…'
  }, [runningTasks])

  const isBusy = currentTaskMessage !== null

  const pullRequest =
    context.view === 'pr-detail' ? context.pullRequest : undefined

  return (
    <footer
      className="
        w-full bg-titlebar border-t border-border
        flex items-center gap-3 px-3 h-footer
        select-none
      "
    >
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground min-w-0">
        {isBusy ? (
          <>
            <Loader2 className="size-2.5 animate-spin shrink-0" />
            <span className="truncate">{currentTaskMessage}</span>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-primary shrink-0"
            />
            <span className="truncate">Synchronized · pull requests</span>
          </>
        )}

        {user?.login ? <span className="truncate">· {user.login}</span> : null}
      </div>

      <div className="flex-1" />

      {pullRequest ? (
        <PullRequestFooterActions pullRequest={pullRequest} />
      ) : null}
    </footer>
  )
}
