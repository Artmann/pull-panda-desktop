import { ChevronDown, ChevronUp, GitMergeIcon, Loader2 } from 'lucide-react'
import { memo, ReactElement, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu'
import { Separator } from '@/app/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
import { createReview, getMergeOptions, mergePullRequest } from '@/app/lib/api'
import type { MergeOptions } from '@/app/lib/api'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  createOptimisticReview,
  pendingReviewsActions
} from '@/app/store/pending-reviews-slice'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { PullRequest } from '@/types/pull-request'

type MergeMethod = 'merge' | 'squash' | 'rebase'

const mergeMethodLabels: Record<MergeMethod, string> = {
  merge: 'Merge commit',
  rebase: 'Rebase and merge',
  squash: 'Squash and merge'
}

interface PullRequestToolbarProps {
  pullRequest: PullRequest
}

export const PullRequestToolbar = memo(function PullRequestToolbar({
  pullRequest
}: PullRequestToolbarProps): ReactElement {
  const dispatch = useAppDispatch()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )

  const hasPendingReview = Boolean(pendingReview)

  const [mergeOptions, setMergeOptions] = useState<MergeOptions | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<MergeMethod | null>(null)

  useEffect(() => {
    if (pullRequest.state !== 'OPEN') {
      return
    }

    getMergeOptions(pullRequest.id)
      .then((options) => {
        setMergeOptions(options)

        const first =
          (options.allowSquashMerge && 'squash') ||
          (options.allowMergeCommit && 'merge') ||
          (options.allowRebaseMerge && 'rebase') ||
          null

        setSelectedMethod(first as MergeMethod | null)
      })
      .catch(() => {
        // Silently fail — merge button just won't appear.
      })
  }, [pullRequest.id, pullRequest.state])

  const allowedMethods: MergeMethod[] = mergeOptions
    ? ([
        mergeOptions.allowMergeCommit && 'merge',
        mergeOptions.allowSquashMerge && 'squash',
        mergeOptions.allowRebaseMerge && 'rebase'
      ].filter(Boolean) as MergeMethod[])
    : []

  const handleMerge = (mergeMethod: MergeMethod) => {
    const originalPr = pullRequest

    dispatch(
      pullRequestsActions.upsertItem({
        ...pullRequest,
        mergedAt: new Date().toISOString(),
        state: 'MERGED'
      })
    )

    mergePullRequest({
      mergeMethod,
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

  const handleStartReview = async () => {
    if (hasPendingReview) {
      return
    }

    const optimisticReview = createOptimisticReview(pullRequest.id)

    dispatch(
      pendingReviewsActions.setReview({
        pullRequestId: pullRequest.id,
        review: optimisticReview
      })
    )

    try {
      const review = await createReview({
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        repo: pullRequest.repositoryName
      })

      dispatch(
        pendingReviewsActions.setReview({
          pullRequestId: pullRequest.id,
          review: {
            ...review,
            pullRequestId: pullRequest.id
          }
        })
      )
    } catch (error) {
      console.error('Failed to start review:', error)

      dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )

      const message =
        error instanceof Error ? error.message : 'Failed to start review'

      toast.error(message)
    }
  }

  const mergeDisabled = mergeOptions ? mergeOptions.mergeable !== true : false

  const mergeDisabledReason = mergeOptions
    ? getMergeDisabledReason(mergeOptions)
    : null

  const showMerge =
    pullRequest.state === 'OPEN' && selectedMethod && allowedMethods.length > 0

  return (
    <div
      className={`
        fixed bottom-10 left-1/2 -translate-x-1/2 z-30
        bg-background
        rounded-sm border border-border shadow-sm
        p-1.5
        flex items-center gap-2
    `}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
        >
          <ChevronDown className="size-3" />
        </Button>

        <Button
          variant="outline"
          size="icon-xs"
        >
          <ChevronUp className="size-3" />
        </Button>
      </div>

      {!pullRequest.isAuthor && (
        <>
          <Separator orientation="vertical" />
          <div className="flex items-center gap-1">
            {hasPendingReview ? (
              <Button
                size="xs"
                variant="outline"
              >
                Review in progress
              </Button>
            ) : (
              <Button
                onClick={handleStartReview}
                size="xs"
              >
                Start review
              </Button>
            )}
          </div>
        </>
      )}

      {showMerge && (
        <>
          <Separator orientation="vertical" />

          <div className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    className="rounded-r-none"
                    disabled={mergeDisabled}
                    onClick={() => handleMerge(selectedMethod)}
                    size="xs"
                  >
                    {mergeOptions?.mergeable === null ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <GitMergeIcon className="size-3" />
                    )}
                    {mergeDisabledReason ?? mergeMethodLabels[selectedMethod]}
                  </Button>
                </span>
              </TooltipTrigger>

              {mergeDisabledReason && (
                <TooltipContent side="top">
                  {mergeDisabledReason}
                </TooltipContent>
              )}
            </Tooltip>

            {allowedMethods.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="rounded-l-none border-l border-l-primary-foreground/20 px-1.5"
                    disabled={mergeDisabled}
                    size="xs"
                  >
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  {allowedMethods.map((method) => (
                    <DropdownMenuItem
                      key={method}
                      onSelect={() => setSelectedMethod(method)}
                    >
                      {mergeMethodLabels[method]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </>
      )}
    </div>
  )
})

function getMergeDisabledReason(options: MergeOptions): string | null {
  if (options.mergeable === true) {
    return null
  }

  if (options.mergeable === null) {
    return 'Checking mergeability'
  }

  switch (options.mergeableState) {
    case 'blocked':
      return 'Merge blocked'
    case 'dirty':
      return 'Has merge conflicts'
    case 'unstable':
      return 'Checks are failing'
    default:
      return 'Cannot merge'
  }
}
