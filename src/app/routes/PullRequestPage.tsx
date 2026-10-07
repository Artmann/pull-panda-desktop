import { ArrowLeft } from 'lucide-react'
import { useRef, type ReactElement } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { Button } from '@/app/components/ui/button'
import { usePullRequestNavigation } from '@/app/pull-requests/PullRequestNavigationProvider'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { mergeDrawerActions } from '@/app/store/merge-drawer-slice'

import { MergeDrawer } from '../pull-requests/MergeDrawer'
import {
  PullRequestHeader,
  StickyPullRequestHeader
} from '../pull-requests/PullRequestHeader'
import { ReviewDrawer } from '../pull-requests/ReviewDrawer'
import { getActiveTab } from './pull-request-tab'
import { PullRequestTabs } from './PullRequestTabs'
import {
  useScrollRestoration,
  useStickyHeaderProgress
} from './use-pull-request-scroll'
import {
  useMergeOptionsPolling,
  usePendingReviewHydration,
  usePullRequestFocus
} from './use-pull-request-sync'

function PullRequestNotFound(): ReactElement {
  return (
    <div className="w-full max-w-wide mx-auto px-6 py-8">
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

export function PullRequestPage(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  const { id } = useParams<{ id: string }>()

  const pullRequest = useAppSelector((state) =>
    state.pullRequests.items.find((pr) => pr.id === id)
  )

  // The footer action bar opens the merge drawer, so the flag lives in the
  // store; opening it also re-runs the merge options fetch below.
  const isMergeDrawerOpen = useAppSelector(
    (state) => state.mergeDrawer.openForPullRequestId === id
  )

  const dispatch = useAppDispatch()
  const [searchParams] = useSearchParams()
  const navigation = usePullRequestNavigation()

  const activeTab = getActiveTab(searchParams.get('tab'))

  usePullRequestFocus(id)
  usePendingReviewHydration(pullRequest)
  useMergeOptionsPolling(pullRequest, isMergeDrawerOpen)

  const stickyHeaderProgress = useStickyHeaderProgress(containerRef, navigation)

  useScrollRestoration(containerRef, navigation, id, activeTab)

  const handleTabChange = (tabId: string) => {
    if (!id) {
      return
    }

    navigation.setActiveTab(id, tabId)
  }

  if (!pullRequest) {
    return <PullRequestNotFound />
  }

  return (
    <div
      className="w-full max-w-wide mx-auto"
      ref={containerRef}
    >
      <StickyPullRequestHeader
        pullRequest={pullRequest}
        transitionProgress={stickyHeaderProgress}
      />

      <PullRequestHeader pullRequest={pullRequest} />

      <MergeDrawer
        onClose={() => dispatch(mergeDrawerActions.close())}
        open={isMergeDrawerOpen}
        pullRequest={pullRequest}
      />

      <ReviewDrawer pullRequest={pullRequest} />

      <PullRequestTabs
        activeTab={activeTab}
        id={id}
        onTabChange={handleTabChange}
        pullRequest={pullRequest}
      />
    </div>
  )
}
