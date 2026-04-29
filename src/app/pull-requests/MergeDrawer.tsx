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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
import { mergePullRequest } from '@/app/lib/api'
import type { MergeOptions, MergeRequirement } from '@/app/lib/api'
import { cn } from '@/app/lib/utils'
import { BranchSyncActions } from '@/app/pull-requests/components/BranchSyncActions'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { Check, Review } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

type MergeMethod = 'merge' | 'rebase' | 'squash'

const mergeMethodStorageKey = 'pull-panda-merge-method'

function getSavedMergeMethod(repo: string): MergeMethod | null {
  const stored = localStorage.getItem(mergeMethodStorageKey)

  if (!stored) {
    return null
  }

  try {
    const map = JSON.parse(stored) as Record<string, string>

    const method = map[repo]

    if (method === 'merge' || method === 'rebase' || method === 'squash') {
      return method
    }

    return null
  } catch {
    return null
  }
}

function saveMergeMethod(repo: string, method: MergeMethod): void {
  let map: Record<string, string> = {}
  const stored = localStorage.getItem(mergeMethodStorageKey)

  if (stored) {
    try {
      map = JSON.parse(stored) as Record<string, string>
    } catch {
      // Ignore corrupt data.
    }
  }

  map[repo] = method
  localStorage.setItem(mergeMethodStorageKey, JSON.stringify(map))
}

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
  const [selectedMethod, setSelectedMethod] = useState<MergeMethod | null>(null)
  const [showSquashFields, setShowSquashFields] = useState(false)

  const dispatch = useAppDispatch()

  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

  const reviews = useAppSelector((state) =>
    state.reviews.items.filter(
      (review) => review.pullRequestId === pullRequest.id
    )
  )

  const checks = useAppSelector((state) =>
    state.checks.items.filter((check) => check.pullRequestId === pullRequest.id)
  )

  useEffect(
    function initializeSelectedMethod() {
      if (!mergeOptions || mergeOptions.mergeable === null) {
        setSelectedMethod(null)

        return
      }

      const repo = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`
      const saved = getSavedMergeMethod(repo)

      const allowedMap: Record<MergeMethod, boolean> = {
        merge: mergeOptions.allowMergeCommit,
        rebase: mergeOptions.allowRebaseMerge,
        squash: mergeOptions.allowSquashMerge
      }

      const initial =
        (saved && allowedMap[saved] && saved) ||
        (mergeOptions.allowSquashMerge && 'squash') ||
        (mergeOptions.allowMergeCommit && 'merge') ||
        (mergeOptions.allowRebaseMerge && 'rebase') ||
        null

      setSelectedMethod(initial as MergeMethod | null)
    },
    [mergeOptions, pullRequest.repositoryName, pullRequest.repositoryOwner]
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
    const repo = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`
    saveMergeMethod(repo, method)

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
          <span className="text-xs bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground">
            #{pullRequest.number}
          </span>

          <span className="text-xs bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground">
            {pullRequest.repositoryOwner}/{pullRequest.repositoryName}
          </span>
        </div>
      </SidePanelHeader>

      <SidePanelContent className={showSquashFields ? 'flex flex-col' : ''}>
        <div
          className={
            showSquashFields
              ? 'flex flex-col flex-1 min-h-0 p-5 pt-2'
              : 'flex flex-col gap-8 p-5 pt-2'
          }
        >
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

              {mergeOptions !== null &&
                mergeOptions.mergeable !== null &&
                mergeOptions.requirements.length > 0 && (
                  <MergeRequirementsChecklist
                    requirements={mergeOptions.requirements}
                  />
                )}

              <BranchSyncActions pullRequest={pullRequest} />

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
        <div className="flex flex-col gap-6 max-w-72 mx-auto w-full">
          {allowedMethods.length > 0 && !showSquashFields && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {(['squash', 'merge', 'rebase'] as MergeMethod[])
                  .filter((method) => allowedMethods.includes(method))
                  .map((method) => (
                    <button
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer transition-colors text-xs font-medium',
                        selectedMethod === method
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-foreground/20'
                      )}
                      key={method}
                      onClick={() => handleTabClick(method)}
                      type="button"
                    >
                      <MergeMethodIcon method={method} />
                      {mergeMethodShortLabels[method]}
                    </button>
                  ))}
              </div>

              {selectedMethod && (
                <p className="text-xs text-muted-foreground text-center">
                  {mergeMethodDescriptions[selectedMethod]}
                </p>
              )}
            </div>
          )}

          {canMerge && selectedMethod ? (
            <Button
              className="w-full bg-status-success border border-status-success-border text-status-success-foreground hover:bg-status-success/90"
              onClick={handleMerge}
              size="sm"
            >
              <GitMerge className="size-3" />
              {mergeMethodLabels[selectedMethod]}
            </Button>
          ) : (
            mergeOptions !== null &&
            !canMerge && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 items-center">
                  <Button
                    className="w-full"
                    disabled
                    size="sm"
                    variant="outline"
                  >
                    <ShieldAlert className="size-3" />
                    Merge is blocked
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    {mergeBlockedSummary(mergeOptions)}
                  </p>
                </div>

                {mergeOptions.mergeableState === 'dirty' ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          className="w-full"
                          disabled
                          size="sm"
                          variant="destructive"
                        >
                          Merge without waiting for requirements
                        </Button>
                      </div>
                    </TooltipTrigger>

                    <TooltipContent>
                      Cannot merge while there are conflicts.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    className="w-full"
                    onClick={handleForceMerge}
                    size="sm"
                    variant="destructive"
                  >
                    Merge without waiting for requirements
                  </Button>
                )}
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
    return <GitCommitHorizontal className="size-3.5" />
  }

  if (method === 'rebase') {
    return <GitBranch className="size-3.5" />
  }

  return <GitMerge className="size-3.5" />
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
    summaryIcon = (
      <CheckCircle2 className="size-4 text-status-success-foreground shrink-0" />
    )
    summaryText = `${approvalCount} ${label}`
  } else {
    summaryIcon = <Clock className="size-4 text-muted-foreground shrink-0" />
    summaryText = 'Awaiting review'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        {summaryIcon}
        <span>{summaryText}</span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
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
    return (
      <CheckCircle2 className="size-4 text-status-success-foreground shrink-0" />
    )
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
    summaryIcon = (
      <XCircle className="size-4 text-status-danger-foreground shrink-0" />
    )
    summaryText = `${summary.failed} of ${total} checks failed`
  } else if (summary.pending > 0) {
    summaryIcon = (
      <Loader2 className="size-4 text-muted-foreground shrink-0 animate-spin" />
    )
    summaryText = `${summary.pending} checks running`
  } else {
    summaryIcon = (
      <CheckCircle2 className="size-4 text-status-success-foreground shrink-0" />
    )
    summaryText = 'All checks have passed'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        {summaryIcon}
        <span>{summaryText}</span>
      </div>

      {failedChecks.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
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

function mergeBlockedSummary(mergeOptions: MergeOptions): string {
  const failing = mergeOptions.requirements.filter(
    (requirement) => !requirement.satisfied
  )

  if (failing.length > 0) {
    return failing.map((requirement) => requirement.description).join(' ')
  }

  if (mergeOptions.mergeableState === 'dirty') {
    return 'This branch has conflicts that must be resolved.'
  }

  if (mergeOptions.mergeableState === 'blocked') {
    return 'Blocked by branch protection rules.'
  }

  return 'This pull request cannot be merged.'
}

interface MergeRequirementsChecklistProps {
  requirements: MergeRequirement[]
}

function MergeRequirementsChecklist({
  requirements
}: MergeRequirementsChecklistProps): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Requirements
      </h4>

      <div className="border border-border rounded-lg overflow-hidden">
        {requirements.map((requirement) => (
          <div
            className="flex items-start gap-3 px-3 py-2.5 text-sm border-b border-border last:border-0"
            key={requirement.key}
          >
            <RequirementIcon satisfied={requirement.satisfied} />

            <div className="flex flex-col gap-0.5 min-w-0">
              <span
                className={cn(
                  'truncate',
                  requirement.satisfied ? 'text-foreground' : 'text-red-500'
                )}
              >
                {requirement.label}
              </span>

              {!requirement.satisfied && (
                <span className="text-xs text-muted-foreground">
                  {requirement.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RequirementIcon({ satisfied }: { satisfied: boolean }): ReactElement {
  if (satisfied) {
    return (
      <CheckCircle2 className="size-4 text-status-success-foreground shrink-0 mt-0.5" />
    )
  }

  return <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
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
