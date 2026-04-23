import {
  ArrowLeft,
  FileCodeIcon,
  ListCheckIcon,
  MessageSquareIcon
} from 'lucide-react'
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { Button } from '@/app/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/tabs'
import { getMergeOptions, markPullRequestActive } from '@/app/lib/api'
import { usePullRequestNavigation } from '@/app/pull-requests/PullRequestNavigationProvider'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { mergeOptionsActions } from '@/app/store/merge-options-slice'
import { clamp01 } from '@/math'

import { ChecksView } from '../pull-requests/ChecksView'
import { FilesView } from '../pull-requests/FilesView'
import { MergeDrawer } from '../pull-requests/MergeDrawer'
import { Overview } from '../pull-requests/Overview'
import {
  PullRequestHeader,
  StickyPullRequestHeader
} from '../pull-requests/PullRequestHeader'
import { PullRequestToolbar } from '../pull-requests/PullRequestToolbar'
import { ReviewDrawer } from '../pull-requests/ReviewDrawer'

export function PullRequestPage(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMergeDrawerOpen, setIsMergeDrawerOpen] = useState(false)
  const [stickyHeaderProgress, setStickyHeaderProgress] = useState(0)

  const { id } = useParams<{ id: string }>()

  const pullRequest = useAppSelector((state) =>
    state.pullRequests.items.find((pr) => pr.id === id)
  )

  const dispatch = useAppDispatch()
  const [searchParams] = useSearchParams()
  const navigation = usePullRequestNavigation()

  const checksCount = useAppSelector(
    (state) => state.checks.items.filter((c) => c.pullRequestId === id).length
  )
  const filesCount = useAppSelector(
    (state) =>
      state.modifiedFiles.items.filter((f) => f.pullRequestId === id).length
  )

  const tabFromUrl = searchParams.get('tab')
  const validTabs = ['overview', 'checks', 'files']
  const activeTab =
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'overview'

  useEffect(
    function activatePullRequest() {
      if (id) {
        markPullRequestActive(id)
      }
    },
    [id]
  )

  const [fetchGeneration, setFetchGeneration] = useState(0)

  useEffect(
    function fetchMergeOptions() {
      if (!pullRequest || pullRequest.state !== 'OPEN') {
        return
      }

      let cancelled = false
      let retryTimeout: ReturnType<typeof setTimeout> | null = null

      const fetch = () => {
        getMergeOptions(pullRequest.id)
          .then((options) => {
            if (cancelled) return

            dispatch(
              mergeOptionsActions.setForPullRequest({
                options,
                pullRequestId: pullRequest.id
              })
            )

            if (options.mergeable === null) {
              retryTimeout = setTimeout(fetch, 3000)
            }
          })
          .catch(() => {
            // Silently fail — merge button just won't appear.
          })
      }

      fetch()

      return () => {
        cancelled = true

        if (retryTimeout !== null) {
          clearTimeout(retryTimeout)
        }
      }
    },
    [dispatch, fetchGeneration, pullRequest?.id, pullRequest?.state]
  )

  const refreshMergeOptions = useCallback(() => {
    if (pullRequest) {
      dispatch(mergeOptionsActions.clearForPullRequest(pullRequest.id))
    }

    setFetchGeneration((generation) => generation + 1)
  }, [dispatch, pullRequest?.id])

  const tabs: Array<{
    content: React.ComponentType<{
      pullRequest: NonNullable<typeof pullRequest>
    }>
    icon: typeof MessageSquareIcon
    id: string
    itemCount?: number
    label: string
  }> = useMemo(
    () => [
      {
        content: Overview,
        icon: MessageSquareIcon,
        id: 'overview',
        label: 'Overview'
      },
      {
        content: ChecksView,
        icon: ListCheckIcon,
        id: 'checks',
        itemCount: checksCount,
        label: 'Checks'
      },
      {
        content: FilesView,
        icon: FileCodeIcon,
        id: 'files',
        itemCount: filesCount,
        label: 'Files'
      }
    ],
    [checksCount, filesCount]
  )

  useEffect(
    function trackScrollPosition() {
      const scrollContainer = containerRef.current?.closest('.overflow-auto')

      if (!(scrollContainer instanceof HTMLElement)) {
        return
      }

      navigation.registerScrollContainer(scrollContainer)

      let rafId: number | null = null

      const onScroll = () => {
        if (rafId !== null) return

        rafId = requestAnimationFrame(() => {
          rafId = null
          const threshold = 110
          const progress = clamp01(
            Math.min(scrollContainer.scrollTop, threshold) / threshold
          )

          setStickyHeaderProgress(progress)
        })
      }

      scrollContainer.addEventListener('scroll', onScroll)

      onScroll()

      return () => {
        scrollContainer.removeEventListener('scroll', onScroll)
        if (rafId !== null) cancelAnimationFrame(rafId)
      }
    },
    [navigation]
  )

  useLayoutEffect(
    function restoreScrollPosition() {
      if (!id) {
        return
      }

      const scrollContainer = containerRef.current?.closest('.overflow-auto')

      if (!(scrollContainer instanceof HTMLElement)) {
        return
      }

      navigation.setActiveKey(id, activeTab)

      const saved = navigation.getScrollPosition(id, activeTab)

      scrollContainer.scrollTop = saved
    },
    [id, activeTab, navigation]
  )

  const handleTabChange = (tabId: string) => {
    if (!id) {
      return
    }

    navigation.setActiveTab(id, tabId)
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

      <PullRequestToolbar
        onOpenMergeDrawer={() => {
          setIsMergeDrawerOpen(true)
          refreshMergeOptions()
        }}
        pullRequest={pullRequest}
      />

      <MergeDrawer
        onClose={() => setIsMergeDrawerOpen(false)}
        open={isMergeDrawerOpen}
        pullRequest={pullRequest}
      />

      <ReviewDrawer pullRequest={pullRequest} />

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
                className="px-6 py-2 cursor-pointer text-xs flex-1 flex justify-center items-center"
                value={tab.id}
              >
                <tab.icon className="size-4" /> {tab.label}
                {tab.itemCount !== undefined && (
                  <div className="text-[11px] bg-muted rounded-sm text-center px-1.5 ml-1.5 mt-1">
                    {tab.itemCount}
                  </div>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1">
          {tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              aria-hidden={tab.id !== activeTab}
              className="h-full px-6 py-0"
              forceMount
              hidden={tab.id !== activeTab}
              value={tab.id}
            >
              <div className="w-full pb-12">
                <tab.content pullRequest={pullRequest} />
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
