import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Loader2,
  ShieldAlert,
  X,
  XCircle
} from 'lucide-react'
import { memo, ReactElement, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import {
  SidePanel,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle
} from '@/app/components/ui/side-panel'
import { Textarea } from '@/app/components/ui/textarea'
import { getMergeOptions, mergePullRequest } from '@/app/lib/api'
import type { MergeOptions } from '@/app/lib/api'
import { cn } from '@/app/lib/utils'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { Check, Review } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

type MergeMethod = 'merge' | 'rebase' | 'squash'

const mergeMethodDescriptions: Record<MergeMethod, string> = {
  merge: 'All commits will be added to the base branch via a merge commit.',
  rebase: 'All commits will be rebased and added to the base branch.',
  squash: 'All commits will be combined into one commit on the base branch.'
}

const mergeMethodLabels: Record<MergeMethod, string> = {
  merge: 'Merge commit',
  rebase: 'Rebase and merge',
  squash: 'Squash and merge'
}

const mergeMethodShortLabels: Record<MergeMethod, string> = {
  merge: 'Merge',
  rebase: 'Rebase',
  squash: 'Squash'
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
  const [commitMessage, setCommitMessage] = useState('')
  const [commitTitle, setCommitTitle] = useState('')
  const [mergeOptions, setMergeOptions] = useState<MergeOptions | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<MergeMethod | null>(null)
  const [showSquashFields, setShowSquashFields] = useState(false)

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
            if (cancelled) {
              return
            }

            setMergeOptions(options)

            if (options.mergeable === null) {
              retryTimeout = setTimeout(fetch, 3000)
            } else {
              const first =
                (options.allowSquashMerge && 'squash') ||
                (options.allowMergeCommit && 'merge') ||
                (options.allowRebaseMerge && 'rebase') ||
                null

              setSelectedMethod(first as MergeMethod | null)
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

  const canMerge = mergeOptions?.mergeable === true

  const handleTabClick = (method: MergeMethod) => {
    setSelectedMethod(method)
    setShowSquashFields(false)
    setCommitTitle('')
    setCommitMessage('')
  }

  const executeMerge = (method: MergeMethod) => {
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
      ...(method === 'squash' && {
        commitMessage,
        commitTitle
      }),
      mergeMethod: method,
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

  const handleMerge = () => {
    if (!canMerge || !selectedMethod) {
      return
    }

    if (selectedMethod === 'squash' && !showSquashFields) {
      setCommitTitle(`${pullRequest.title} (#${pullRequest.number})`)
      setCommitMessage(pullRequest.body ?? '')
      setShowSquashFields(true)
      return
    }

    executeMerge(selectedMethod)
  }

  const handleForceMerge = () => {
    if (!selectedMethod) {
      return
    }

    executeMerge(selectedMethod)
  }

  return (
    <SidePanel
      className="w-[440px]"
      open={open}
    >
      <SidePanelHeader>
        <div className="flex items-center justify-between">
          <SidePanelTitle>
            {showSquashFields ? 'Squash and merge' : 'Merge pull request'}
          </SidePanelTitle>

          <Button
            onClick={onClose}
            size="icon-xs"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
            #{pullRequest.number}
          </span>

          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
            {pullRequest.repositoryOwner}/{pullRequest.repositoryName}
          </span>
        </div>
      </SidePanelHeader>

      <SidePanelContent className={showSquashFields ? 'flex flex-col' : ''}>
        <div className={showSquashFields ? 'flex flex-col flex-1 min-h-0 p-5 pt-2' : 'flex flex-col gap-8 p-5 pt-2'}>
          {showSquashFields ? (
            <SquashCommitSection
              commitMessage={commitMessage}
              commitTitle={commitTitle}
              onCommitMessageChange={setCommitMessage}
              onCommitTitleChange={setCommitTitle}
            />
          ) : (
            <>
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

              {mergeOptions !== null && mergeOptions.mergeable !== null && (
                <MergeStatusBanner mergeOptions={mergeOptions} />
              )}

              {!mergeOptions && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading merge options...
                </div>
              )}
            </>
          )}
        </div>
      </SidePanelContent>

      <SidePanelFooter>
        <div className="flex flex-col gap-4">
          {allowedMethods.length > 0 && !showSquashFields && (
            <>
              <div className="flex gap-2">
                {(['squash', 'merge', 'rebase'] as MergeMethod[])
                  .filter((method) => allowedMethods.includes(method))
                  .map((method) => (
                    <button
                      className={cn(
                        'flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedMethod === method
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-foreground/20'
                      )}
                      key={method}
                      onClick={() => handleTabClick(method)}
                      type="button"
                    >
                      <MergeMethodIcon method={method} />

                      <span className="text-xs font-medium">
                        {mergeMethodShortLabels[method]}
                      </span>
                    </button>
                  ))}
              </div>

              {selectedMethod && (
                <p className="text-xs text-muted-foreground">
                  {mergeMethodDescriptions[selectedMethod]}
                </p>
              )}
            </>
          )}

          {canMerge && selectedMethod ? (
            <Button
              className="w-full bg-status-success border border-status-success-border text-status-success-foreground hover:opacity-90"
              onClick={handleMerge}
              size="sm"
            >
              <GitMerge className="size-3" />
              {mergeMethodLabels[selectedMethod]}
            </Button>
          ) : (
            mergeOptions !== null &&
            !canMerge && (
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  disabled
                  size="sm"
                  variant="outline"
                >
                  <ShieldAlert className="size-3" />
                  Merge is blocked
                </Button>

                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                  onClick={handleForceMerge}
                  type="button"
                >
                  Merge without waiting for requirements
                </button>
              </div>
            )
          )}
        </div>
      </SidePanelFooter>
    </SidePanel>
  )
})

function MergeMethodIcon({ method }: { method: MergeMethod }): ReactElement {
  if (method === 'squash') {
    return <GitCommitHorizontal className="size-4" />
  }

  if (method === 'rebase') {
    return <GitBranch className="size-4" />
  }

  return <GitMerge className="size-4" />
}

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
  let summaryIcon: ReactElement
  let summaryText: string

  if (changesRequestedCount > 0) {
    summaryIcon = (
      <AlertTriangle className="size-4 text-status-warning-foreground shrink-0" />
    )
    summaryText = 'Changes requested'
  } else if (approvalCount > 0) {
    const label = approvalCount === 1 ? 'approval' : 'approvals'
    summaryIcon = <CheckCircle2 className="size-4 text-status-success-foreground shrink-0" />
    summaryText = `${approvalCount} ${label}`
  } else {
    summaryIcon = (
      <Clock className="size-4 text-muted-foreground shrink-0" />
    )
    summaryText = 'Awaiting review'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        {summaryIcon}
        <span>{summaryText}</span>
      </div>

      <div className="bg-muted/40 border border-border rounded-lg overflow-hidden">
        {reviews.map((review) => (
          <div
            className="flex items-center gap-3 px-3 py-3 text-sm border-b border-border last:border-0"
            key={review.id}
          >
            {review.authorAvatarUrl ? (
              <img
                alt={review.authorLogin ?? ''}
                className="size-6 rounded-full ring-1 ring-foreground/10 shrink-0"
                src={review.authorAvatarUrl}
              />
            ) : (
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                {(review.authorLogin ?? '?').slice(0, 2).toUpperCase()}
              </div>
            )}

            <span className="flex-1 truncate">{review.authorLogin}</span>

            <ReviewStateIcon state={review.state} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewStateIcon({ state }: { state: string }): ReactElement {
  if (state === 'APPROVED') {
    return <CheckCircle2 className="size-4 text-status-success-foreground shrink-0" />
  }

  if (state === 'CHANGES_REQUESTED') {
    return <XCircle className="size-4 text-status-danger-foreground shrink-0" />
  }

  return <Clock className="size-4 text-muted-foreground shrink-0" />
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

  const total = summary.failed + summary.passed + summary.pending
  let summaryIcon: ReactElement
  let summaryText: string

  if (summary.failed > 0) {
    summaryIcon = <XCircle className="size-4 text-status-danger-foreground shrink-0" />
    summaryText = `${summary.failed} of ${total} checks failed`
  } else if (summary.pending > 0) {
    summaryIcon = (
      <Loader2 className="size-4 text-muted-foreground shrink-0 animate-spin" />
    )
    summaryText = `${summary.pending} checks running`
  } else {
    summaryIcon = <CheckCircle2 className="size-4 text-status-success-foreground shrink-0" />
    summaryText = 'All checks have passed'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        {summaryIcon}
        <span>{summaryText}</span>
      </div>

      {failedChecks.length > 0 && (
        <div className="bg-muted/40 border border-border rounded-lg overflow-hidden">
          {failedChecks.map((check) => (
            <div
              className="flex items-center gap-2 px-3 py-3 text-sm text-status-danger-foreground border-b border-border last:border-0"
              key={check.id}
            >
              <XCircle className="size-3.5 shrink-0" />
              <span className="truncate">{check.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface MergeStatusBannerProps {
  mergeOptions: MergeOptions
}

function MergeStatusBanner({
  mergeOptions
}: MergeStatusBannerProps): ReactElement {
  const { mergeable, mergeableState } = mergeOptions

  if (mergeable === true) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-status-success-border bg-status-success text-sm text-status-success-foreground">
        <GitMerge className="size-4 shrink-0" />
        <span>Branch is ready to merge</span>
      </div>
    )
  }

  if (mergeableState === 'dirty') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-status-danger-border bg-status-danger text-sm text-status-danger-foreground">
        <AlertTriangle className="size-4 shrink-0" />
        <span>This branch has conflicts that must be resolved</span>
      </div>
    )
  }

  if (mergeableState === 'blocked') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-status-warning-border bg-status-warning text-sm text-status-warning-foreground">
        <ShieldAlert className="size-4 shrink-0" />
        <span>Merge is blocked by branch protection rules</span>
      </div>
    )
  }

  if (mergeableState === 'unstable') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-status-warning-border bg-status-warning text-sm text-status-warning-foreground">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Some required checks are failing</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground">
      <ShieldAlert className="size-4 shrink-0" />
      <span>This pull request cannot be merged.</span>
    </div>
  )
}

interface SquashCommitSectionProps {
  commitMessage: string
  commitTitle: string
  onCommitMessageChange: (value: string) => void
  onCommitTitleChange: (value: string) => void
}

function SquashCommitSection({
  commitMessage,
  commitTitle,
  onCommitMessageChange,
  onCommitTitleChange
}: SquashCommitSectionProps): ReactElement {
  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Commit message
      </h4>

      <Input
        onChange={(event) => onCommitTitleChange(event.target.value)}
        placeholder="Commit title"
        value={commitTitle}
      />

      <Textarea
        className="flex-1 resize-none min-h-0"
        onChange={(event) => onCommitMessageChange(event.target.value)}
        placeholder="Commit description (optional)"
        value={commitMessage}
      />
    </div>
  )
}
