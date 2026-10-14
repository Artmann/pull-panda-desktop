import { useMemo, type ComponentType, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import {
  getCheckRollup,
  getCheckTally,
  getLatestChecks
} from '@/app/components/check-rollup'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/tabs'
import { cn } from '@/app/lib/utils'
import { LandmarkScope } from '@/app/pull-requests/PullRequestNavigationProvider'
import type { StatusTone } from '@/app/pull-requests/status-summary'
import { useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'

import { ChecksView } from '../pull-requests/ChecksView'
import { FilesView } from '../pull-requests/FilesView'
import { Overview } from '../pull-requests/Overview'
import { TasksTab } from '../pull-requests/tasks/TasksTab'
import { useDerivedTaskGroups } from '../pull-requests/tasks/use-derived-tasks'

interface TabBadge {
  label: string
  tone: StatusTone
}

interface PullRequestTab {
  badge?: TabBadge
  content: ComponentType<{ pullRequest: PullRequest }>
  id: string
  label: string
  width?: 'wide'
}

const badgeClassNames: Record<StatusTone, string> = {
  danger: 'bg-status-danger text-status-danger-foreground',
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-status-success text-status-success-foreground',
  warning: 'bg-status-warning text-status-warning-foreground'
}

function useChecksBadge(id: string | undefined): TabBadge | undefined {
  // Reduced inside the selector to two numbers and a word, so the page does
  // not re-render on every unrelated check write.
  const summary = useAppSelector((state) => {
    const checks = getLatestChecks(
      state.checks.items.filter((check) => check.pullRequestId === id)
    )
    const tally = getCheckTally(checks)

    return {
      failed: tally.failed,
      rollup: getCheckRollup(checks),
      total: tally.total
    }
  }, shallowEqual)

  if (summary.total === 0) {
    return
  }

  if (summary.rollup === 'failing') {
    return { label: `${summary.failed.toString()} failing`, tone: 'danger' }
  }

  return {
    label: summary.total.toString(),
    tone: summary.rollup === 'running' ? 'warning' : 'success'
  }
}

// Every task group always carries at least one row, so there is always a
// badge to show.
function useTasksBadge(pullRequest: PullRequest): TabBadge {
  const taskGroups = useDerivedTaskGroups(pullRequest)

  return useMemo((): TabBadge => {
    const tasks = taskGroups.flatMap((group) => group.tasks)
    const open = tasks.filter((task) => task.severity !== 'done')

    if (open.length === 0) {
      return {
        label: `${tasks.length.toString()}/${tasks.length.toString()}`,
        tone: 'success'
      }
    }

    // Open work is a to-do list rather than an alarm; what is actually broken
    // is already red in the status strip and the Checks badge.
    return { label: `${open.length.toString()} open`, tone: 'warning' }
  }, [taskGroups])
}

function usePullRequestTabs(
  id: string | undefined,
  pullRequest: PullRequest
): PullRequestTab[] {
  const checksBadge = useChecksBadge(id)
  const tasksBadge = useTasksBadge(pullRequest)
  const filesCount = useAppSelector(
    (state) =>
      state.modifiedFiles.items.filter((f) => f.pullRequestId === id).length
  )

  return useMemo(
    () => [
      {
        content: Overview,
        id: 'overview',
        label: 'Overview'
      },
      {
        badge: tasksBadge,
        content: TasksTab,
        id: 'tasks',
        label: 'Tasks'
      },
      {
        badge: checksBadge,
        content: ChecksView,
        id: 'checks',
        label: 'Checks'
      },
      {
        badge: { label: filesCount.toString(), tone: 'neutral' },
        content: FilesView,
        id: 'files',
        label: 'Files',
        // Diffs wrap badly at 78 characters and file paths are long.
        width: 'wide'
      }
    ],
    [checksBadge, filesCount, tasksBadge]
  )
}

function PullRequestTabTrigger({ tab }: { tab: PullRequestTab }): ReactElement {
  return (
    <TabsTrigger
      className="flex-none cursor-pointer gap-2 px-3 text-sm after:bg-transparent"
      value={tab.id}
    >
      {tab.label}

      {tab.badge && (
        <span
          className={cn(
            'min-w-4 rounded-full px-1.5 text-center text-2xs tabular-nums',
            badgeClassNames[tab.badge.tone]
          )}
        >
          {tab.badge.label}
        </span>
      )}
    </TabsTrigger>
  )
}

interface PullRequestTabPanelProps {
  activeTab: string
  id: string | undefined
  pullRequest: PullRequest
  tab: PullRequestTab
}

function PullRequestTabPanel({
  activeTab,
  id,
  pullRequest,
  tab
}: PullRequestTabPanelProps): ReactElement {
  return (
    <TabsContent
      aria-hidden={tab.id !== activeTab}
      className="h-full py-0"
      forceMount
      hidden={tab.id !== activeTab}
      value={tab.id}
    >
      <div
        className={cn(
          'w-full px-6 pb-6',
          tab.width === 'wide' ? 'max-w-wide' : 'max-w-content'
        )}
      >
        {id ? (
          <LandmarkScope
            pullRequestId={id}
            tab={tab.id}
          >
            <tab.content pullRequest={pullRequest} />
          </LandmarkScope>
        ) : (
          <tab.content pullRequest={pullRequest} />
        )}
      </div>
    </TabsContent>
  )
}

interface PullRequestTabsProps {
  activeTab: string
  id: string | undefined
  onTabChange: (tabId: string) => void
  pullRequest: PullRequest
}

export function PullRequestTabs({
  activeTab,
  id,
  onTabChange,
  pullRequest
}: PullRequestTabsProps): ReactElement {
  const tabs = usePullRequestTabs(id, pullRequest)
  const isWide = tabs.find((tab) => tab.id === activeTab)?.width === 'wide'

  return (
    <Tabs
      className="flex flex-col flex-1 min-h-0"
      value={activeTab}
      onValueChange={onTabChange}
    >
      {/*
        The tab bar stays pinned while the page scrolls under it. Its height
        is the `sticky-header` spacing token, which pinned file card headers
        use to sit flush below it.
      */}
      <div className="sticky top-0 z-20 mt-6 w-full shrink-0 bg-background">
        <div className={cn('px-6', isWide ? 'max-w-wide' : 'max-w-content')}>
          <div className="border-b border-border">
            <TabsList className="-mb-px gap-1 bg-transparent">
              {tabs.map((tab) => (
                <PullRequestTabTrigger
                  key={tab.id}
                  tab={tab}
                />
              ))}
            </TabsList>
          </div>
        </div>
      </div>

      <div className="flex-1">
        {tabs.map((tab) => (
          <PullRequestTabPanel
            key={tab.id}
            activeTab={activeTab}
            id={id}
            pullRequest={pullRequest}
            tab={tab}
          />
        ))}
      </div>
    </Tabs>
  )
}
