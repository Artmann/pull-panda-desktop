import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDot,
  GitMergeIcon,
  Loader2,
  XCircle
} from 'lucide-react'
import { memo, ReactElement, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import {
  SidePanel,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle
} from '@/app/components/ui/side-panel'
import { getMergeOptions, mergePullRequest } from '@/app/lib/api'
import type { MergeOptions } from '@/app/lib/api'
import { cn } from '@/app/lib/utils'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { Check, Review } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

type MergeMethod = 'merge' | 'rebase' | 'squash'

const mergeMethodLabels: Record<MergeMethod, string> = {
  merge: 'Merge commit',
  rebase: 'Rebase and merge',
  squash: 'Squash and merge'
}

const mergeMethodDescriptions: Record<MergeMethod, string> = {
  merge: 'All commits will be added to the base branch via a merge commit.',
  rebase: 'All commits will be rebased and added to the base branch.',
  squash: 'All commits will be combined into one commit on the base branch.'
}

interface MergeDrawerProps {
  onClose: () => void
  open: boolean
  pullRequest: PullRequest
}

export const MergeDrawer = memo(function MergeDrawer({
  onClose,
  open,
  pullRequest
}: MergeDrawerProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mergeOptions, setMergeOptions] = useState<MergeOptions | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<MergeMethod | null>(null)

  const dispatch = useAppDispatch()

  const reviews = useAppSelector((state) =>
    state.reviews.items.filter(
      (review) => review.pullRequestId === pullRequest.id
    )
  )

  const checks = useAppSelector((state) =>
    state.checks.items.filter((check) => check.pullRequestId === pullRequest.id)
  )

  useEffect(
    function fetchMergeOptions() {
      if (!open || pullRequest.state !== 'OPEN') {
        return
      }

      let cancelled = false
      let retryTimeout: ReturnType<typeof setTimeout> | null = null

      const fetch = () => {
        getMergeOptions(pullRequest.id)
          .then((options) => {
            if (cancelled) return

            setMergeOptions(options)

            const first =
              (options.allowSquashMerge && 'squash') ||
              (options.allowMergeCommit && 'merge') ||
              (options.allowRebaseMerge && 'rebase') ||
              null

            setSelectedMethod(first as MergeMethod | null)

            if (options.mergeable === null) {
              retryTimeout = setTimeout(fetch, 3000)
            }
          })
          .catch(() => {
            // Silently fail — merge options just won't appear.
          })
      }

      setMergeOptions(null)
      setSelectedMethod(null)
      fetch()

      return () => {
        cancelled = true

        if (retryTimeout !== null) {
          clearTimeout(retryTimeout)
        }
      }
    },
    [open, pullRequest.id, pullRequest.state]
  )

  const allowedMethods: MergeMethod[] = mergeOptions
    ? ([
        mergeOptions.allowSquashMerge && 'squash',
        mergeOptions.allowMergeCommit && 'merge',
        mergeOptions.allowRebaseMerge && 'rebase'
      ].filter(Boolean) as MergeMethod[])
    : []

  const latestReviews = useLatestReviews(reviews)
  const checksSummary = useChecksSummary(checks)

  const mergeDisabledReason = mergeOptions
    ? getMergeDisabledReason(mergeOptions)
    : null

  const canMerge = mergeOptions?.mergeable === true && selectedMethod !== null

  const handleMerge = () => {
    if (!selectedMethod || !canMerge) {
      return
    }

    const originalPr = pullRequest

    dispatch(
      pullRequestsActions.upsertItem({
        ...pullRequest,
        mergedAt: new Date().toISOString(),
        state: 'MERGED'
      })
    )

    onClose()

    mergePullRequest({
      mergeMethod: selectedMethod,
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName
    })
      .then((updated) => {
        dispatch(pullRequestsActions.upsertItem(updated))
      })
      .catch((error) => {
        dispatch(pullRequestsActions.upsertItem(originalPr))

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to merge pull request'

        toast.error(message)
      })
  }

  const statusDescription = mergeOptions
    ? (mergeDisabledReason ?? 'This pull request is ready to merge.')
    : 'Loading merge status...'

  return (
    <SidePanel
      collapsed={isCollapsed}
      open={open}
    >
      <div className="absolute -left-3 top-1/2 -translate-y-1/2">
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          size="icon-xs"
          variant="outline"
        >
          {isCollapsed ? (
            <ChevronLeftIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )}
        </Button>
      </div>

      <SidePanelHeader collapsed={isCollapsed}>
        <SidePanelTitle>Merge pull request</SidePanelTitle>
        <SidePanelDescription>{statusDescription}</SidePanelDescription>
      </SidePanelHeader>

      {!isCollapsed && (
        <>
          <SidePanelContent>
            <div className="flex flex-col gap-6 p-4 pt-0">
              {latestReviews.length > 0 && (
                <ReviewsSection
                  approvalCount={pullRequest.approvalCount}
                  changesRequestedCount={pullRequest.changesRequestedCount}
                  reviews={latestReviews}
                />
              )}

              {checks.length > 0 && (
                <ChecksSection
                  checks={checks}
                  summary={checksSummary}
                />
              )}

              {allowedMethods.length > 0 && (
                <MergeMethodSection
                  allowedMethods={allowedMethods}
                  onSelect={setSelectedMethod}
                  selectedMethod={selectedMethod}
                />
              )}

              {!mergeOptions && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading merge options...
                </div>
              )}
            </div>
          </SidePanelContent>

          <SidePanelFooter>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={!canMerge}
                onClick={handleMerge}
                size="sm"
              >
                <GitMergeIcon className="size-3" />
                {selectedMethod ? mergeMethodLabels[selectedMethod] : 'Merge'}
              </Button>

              <Button
                className="w-full"
                onClick={onClose}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </SidePanelFooter>
        </>
      )}
    </SidePanel>
  )
})

function useLatestReviews(reviews: Review[]): Review[] {
  return useMemo(() => {
    const byAuthor = new Map<string, Review>()

    for (const review of reviews) {
      const key = review.authorLogin ?? review.id
      const existing = byAuthor.get(key)

      if (
        !existing ||
        (review.gitHubSubmittedAt ?? '') > (existing.gitHubSubmittedAt ?? '')
      ) {
        byAuthor.set(key, review)
      }
    }

    return Array.from(byAuthor.values())
  }, [reviews])
}

interface ChecksSummary {
  failed: number
  passed: number
  pending: number
}

function useChecksSummary(checks: Check[]): ChecksSummary {
  return useMemo(() => {
    let failed = 0
    let passed = 0
    let pending = 0

    for (const check of checks) {
      const conclusion = check.conclusion

      if (
        conclusion === 'success' ||
        conclusion === 'neutral' ||
        conclusion === 'skipped'
      ) {
        passed++
      } else if (conclusion === null) {
        pending++
      } else {
        failed++
      }
    }

    return { failed, passed, pending }
  }, [checks])
}

interface ReviewsSectionProps {
  approvalCount: number
  changesRequestedCount: number
  reviews: Review[]
}

function ReviewsSection({
  approvalCount,
  changesRequestedCount,
  reviews
}: ReviewsSectionProps): ReactElement {
  const parts: string[] = []

  if (approvalCount > 0) {
    parts.push(
      `${approvalCount} ${approvalCount === 1 ? 'approval' : 'approvals'}`
    )
  }

  if (changesRequestedCount > 0) {
    parts.push(`${changesRequestedCount} changes requested`)
  }

  const summary = parts.length > 0 ? parts.join(', ') : 'No reviews yet'

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Reviews
      </h4>

      <div className="flex flex-col gap-1.5">
        {reviews.map((review) => (
          <div
            className="flex items-center gap-2 text-sm"
            key={review.id}
          >
            {review.authorAvatarUrl && (
              <img
                alt={review.authorLogin ?? ''}
                className="size-5 rounded-full ring-1 ring-foreground/10"
                src={review.authorAvatarUrl}
              />
            )}

            <span className="flex-1 truncate">{review.authorLogin}</span>

            <ReviewStateIndicator state={review.state} />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  )
}

function ReviewStateIndicator({ state }: { state: string }): ReactElement {
  if (state === 'APPROVED') {
    return (
      <span className="text-xs text-status-success-foreground bg-status-success px-1.5 py-0.5 rounded">
        Approved
      </span>
    )
  }

  if (state === 'CHANGES_REQUESTED') {
    return (
      <span className="text-xs text-status-danger-foreground bg-status-danger px-1.5 py-0.5 rounded">
        Changes requested
      </span>
    )
  }

  return (
    <span className="text-xs text-status-neutral-foreground bg-status-neutral px-1.5 py-0.5 rounded">
      Commented
    </span>
  )
}

interface ChecksSectionProps {
  checks: Check[]
  summary: ChecksSummary
}

function ChecksSection({ checks, summary }: ChecksSectionProps): ReactElement {
  const failedChecks = checks.filter(
    (check) =>
      check.conclusion !== null &&
      check.conclusion !== 'success' &&
      check.conclusion !== 'neutral' &&
      check.conclusion !== 'skipped'
  )

  const pendingChecks = checks.filter((check) => check.conclusion === null)

  const parts: string[] = []

  if (summary.passed > 0) {
    parts.push(`${summary.passed} passed`)
  }

  if (summary.failed > 0) {
    parts.push(`${summary.failed} failed`)
  }

  if (summary.pending > 0) {
    parts.push(`${summary.pending} pending`)
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Checks
      </h4>

      <p className="text-sm">{parts.join(', ')}</p>

      {failedChecks.length > 0 && (
        <div className="flex flex-col gap-1">
          {failedChecks.map((check) => (
            <div
              className="flex items-center gap-2 text-sm text-status-danger-foreground"
              key={check.id}
            >
              <XCircle className="size-3.5 shrink-0" />
              <span className="truncate">{check.name}</span>
            </div>
          ))}
        </div>
      )}

      {pendingChecks.length > 0 && (
        <div className="flex flex-col gap-1">
          {pendingChecks.map((check) => (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              key={check.id}
            >
              <CircleDot className="size-3.5 shrink-0" />
              <span className="truncate">{check.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface MergeMethodSectionProps {
  allowedMethods: MergeMethod[]
  onSelect: (method: MergeMethod) => void
  selectedMethod: MergeMethod | null
}

function MergeMethodSection({
  allowedMethods,
  onSelect,
  selectedMethod
}: MergeMethodSectionProps): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Merge method
      </h4>

      <div className="flex flex-col gap-1.5">
        {allowedMethods.map((method) => (
          <button
            className={cn(
              'flex flex-col gap-0.5 rounded-md border p-3 text-left text-sm transition-colors cursor-pointer',
              method === selectedMethod
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-foreground/20'
            )}
            key={method}
            onClick={() => onSelect(method)}
            type="button"
          >
            <span className="font-medium">{mergeMethodLabels[method]}</span>
            <span className="text-xs text-muted-foreground">
              {mergeMethodDescriptions[method]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function getMergeDisabledReason(options: MergeOptions): string | null {
  if (options.mergeable === true) {
    return null
  }

  if (options.mergeable === null) {
    return 'Checking mergeability...'
  }

  switch (options.mergeableState) {
    case 'blocked':
      return 'Merge is blocked by branch protection rules.'
    case 'dirty':
      return 'This branch has merge conflicts that must be resolved.'
    case 'unstable':
      return 'Some required checks are failing.'
    default:
      return 'This pull request cannot be merged.'
  }
}
