import {
  FileCodeIcon,
  ListCheckIcon,
  ListTodoIcon,
  MessageSquareIcon
} from 'lucide-react'
import { useMemo, type ComponentType, type ReactElement } from 'react'

import {
  checkRollupColors,
  getCheckRollup
} from '@/app/components/check-rollup'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/tabs'
import { cn } from '@/app/lib/utils'
import { LandmarkScope } from '@/app/pull-requests/PullRequestNavigationProvider'
import { useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'

import { ChecksView } from '../pull-requests/ChecksView'
import { FilesView } from '../pull-requests/FilesView'
import { Overview } from '../pull-requests/Overview'
import { TasksTab } from '../pull-requests/tasks/TasksTab'
import {
  countOpenBlockers,
  useDerivedTaskGroups
} from '../pull-requests/tasks/use-derived-tasks'

interface PullRequestTab {
  content: ComponentType<{ pullRequest: PullRequest }>
  countColor?: string
  icon: typeof MessageSquareIcon
  id: string
  itemCount?: number
  label: string
  width?: 'wide'
}

function usePullRequestTabs(id: string | undefined): PullRequestTab[] {
  const checksCount = useAppSelector(
    (state) => state.checks.items.filter((c) => c.pullRequestId === id).length
  )
  // Selecting the rollup rather than the checks themselves keeps this a
  // primitive, so the page does not re-render on every unrelated check write.
  const checksRollup = useAppSelector((state) =>
    getCheckRollup(state.checks.items.filter((c) => c.pullRequestId === id))
  )
  const filesCount = useAppSelector(
    (state) =>
      state.modifiedFiles.items.filter((f) => f.pullRequestId === id).length
  )

  const taskGroups = useDerivedTaskGroups(id ?? '')
  const openBlockerCount = useMemo(
    () => countOpenBlockers(taskGroups),
    [taskGroups]
  )

  return useMemo(
    () => [
      {
        content: Overview,
        icon: MessageSquareIcon,
        id: 'overview',
        label: 'Overview'
      },
      {
        content: TasksTab,
        icon: ListTodoIcon,
        id: 'tasks',
        itemCount: openBlockerCount > 0 ? openBlockerCount : undefined,
        label: 'Tasks'
      },
      {
        content: ChecksView,
        // A count is only worth colouring when it says pass or fail; at zero
        // there is nothing to report, so the badge goes away entirely.
        countColor: checkRollupColors[checksRollup],
        icon: ListCheckIcon,
        id: 'checks',
        itemCount: checksCount > 0 ? checksCount : undefined,
        label: 'Checks'
      },
      {
        content: FilesView,
        icon: FileCodeIcon,
        id: 'files',
        itemCount: filesCount,
        label: 'Files',
        // Diffs wrap badly at 78 characters and file paths are long.
        width: 'wide'
      }
    ],
    [checksCount, checksRollup, filesCount, openBlockerCount]
  )
}

function PullRequestTabTrigger({ tab }: { tab: PullRequestTab }): ReactElement {
  return (
    <TabsTrigger
      className="px-3 py-2 cursor-pointer text-xs flex items-center"
      value={tab.id}
    >
      <tab.icon className="size-4" /> {tab.label}
      {tab.itemCount !== undefined && (
        <div
          className={cn(
            'text-2xs tabular-nums bg-muted rounded-sm text-center min-w-4 px-1.5 ml-1.5',
            tab.countColor
          )}
        >
          {tab.itemCount}
        </div>
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
  const tabs = usePullRequestTabs(id)

  return (
    <Tabs
      className="flex flex-col flex-1 min-h-0"
      value={activeTab}
      onValueChange={onTabChange}
    >
      <div className="w-full shrink-0 px-6 bg-background">
        <TabsList className="bg-transparent">
          {tabs.map((tab) => (
            <PullRequestTabTrigger
              key={tab.id}
              tab={tab}
            />
          ))}
        </TabsList>
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
