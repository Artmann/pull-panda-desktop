import {
  ArrowLeft,
  FileCodeIcon,
  GitCommitIcon,
  ListCheckIcon,
  MessageSquareIcon
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router'

import { Button } from '@/app/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  PullRequestHeader,
  StickyPullRequestHeader
} from '../pull-requests/PullRequestHeader'
import { clamp01 } from '@/math'
import { Overview } from '../pull-requests/Overview'
import { CommitsView } from '../pull-requests/CommitsView'
import { ChecksView } from '../pull-requests/ChecksView'
import { FilesView } from '../pull-requests/FIlesView'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/tabs'
import { navigationActions } from '../store/navigationSlice'

export function PullRequestPage(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [stickyHeaderProgress, setStickyHeaderProgress] = useState(0)

  const { id } = useParams<{ id: string }>()

  const pullRequest = useAppSelector((state) =>
    state.pullRequests.items.find((pr) => pr.id === id)
  )

  const dispatch = useAppDispatch()
  const activeTab = useAppSelector(
    (state) => state.navigation.activeTab[id] ?? 'overview'
  )

  const tabs = [
    {
      content: Overview,
      id: 'overview',
      label: 'Overview',
      icon: MessageSquareIcon
    },
    {
      content: CommitsView,
      id: 'commits',
      label: 'Commits',
      icon: GitCommitIcon
    },
    {
      content: ChecksView,
      id: 'checks',
      label: 'Checks',
      icon: ListCheckIcon
    },
    {
      content: FilesView,
      id: 'files',
      label: 'Files',
      icon: FileCodeIcon
    }
  ]

  useEffect(function trackScrollPosition() {
    const scrollContainer = containerRef.current?.closest('.overflow-auto')

    if (!scrollContainer) {
      return
    }

    const onScroll = () => {
      const threshold = 110
      const progress = clamp01(
        Math.min(scrollContainer.scrollTop, threshold) / threshold
      )

      setStickyHeaderProgress(progress)
    }

    scrollContainer.addEventListener('scroll', onScroll)

    onScroll()

    return () => {
      scrollContainer.removeEventListener('scroll', onScroll)
    }
  }, [])

  const handleTabChange = (tabId: string) => {
    dispatch(navigationActions.setActiveTab({ pullRequestId: id, tab: tabId }))
  }

  if (!pullRequest) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Link to="/">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <div className="text-center text-muted-foreground py-12">
          <p>Pull request not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full max-w-240 mx-auto"
      ref={containerRef}
    >
      <StickyPullRequestHeader
        pullRequest={pullRequest}
        transitionProgress={stickyHeaderProgress}
      />

      <PullRequestHeader pullRequest={pullRequest} />

      <Tabs
        className="flex flex-col flex-1 min-h-0"
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <div className="w-full max-w-240 mx-auto shrink-0 px-6 bg-background">
          <TabsList className="bg-transparent w-full">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                className="px-6 py-2 cursor-pointer text-xs flex-1 justify-center"
                value={tab.id}
              >
                <tab.icon className="size-3" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1">
          {tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              className="h-full px-6 py-0"
              forceMount
              hidden={tab.id !== activeTab}
              value={tab.id}
            >
              <div className="w-full">
                <tab.content pullRequest={pullRequest} />
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
