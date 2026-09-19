import { Fragment, memo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import {
  checkRollupColors,
  checkRollupIcons,
  getCheckRollup,
  getCheckRollupSummary,
  getCheckTally
} from '@/app/components/check-rollup'
import { formatNumber } from '@/app/lib/numbers'
import { useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'
import type { Check } from '@/types/pull-request-details'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '../components/ui/tooltip'
import { cn } from '../lib/utils'
import { ReviewerBar } from './ReviewerBar'

/**
 * The line under the title that answers a reviewer's first four questions: do
 * the checks pass, who is looking at it, how big is it, and can it merge.
 *
 * Only the checks carry a verdict, so they are the only coloured field. A
 * diffstat is a magnitude rather than good or bad news, and colouring it too
 * would put a second green beside the green tick and leave the row saying
 * everything at once.
 */
export const PullRequestMetaRow = memo(function PullRequestMetaRow({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const checks: Check[] = useAppSelector(
    (state) =>
      state.checks.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

  // Reduced inside the selector so the row re-renders on the three numbers
  // changing rather than on any write to the files slice.
  const files = useAppSelector((state) => {
    const modified = state.modifiedFiles.items.filter(
      (file) => file.pullRequestId === pullRequest.id
    )

    return {
      additions: modified.reduce(
        (total, file) => total + (file.additions ?? 0),
        0
      ),
      count: modified.length,
      deletions: modified.reduce(
        (total, file) => total + (file.deletions ?? 0),
        0
      )
    }
  }, shallowEqual)

  // `mergeable: false` is GitHub's word for a conflict specifically, not for
  // any old blocker — a failing check leaves it true.
  const hasConflicts = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id]?.mergeable === false
  )

  const rollup = getCheckRollup(checks)
  const RollupIcon = checkRollupIcons[rollup]
  const tally = getCheckTally(checks)
  const segments: ReactElement[] = []

  // A ratio reads as pass or fail, so an empty suite has nothing to say — the
  // same reason the Checks tab drops its badge at zero.
  if (tally.total > 0) {
    segments.push(
      <Tooltip key="checks">
        <TooltipTrigger
          className={cn(
            'flex items-center gap-1.5 cursor-default',
            checkRollupColors[rollup]
          )}
        >
          <RollupIcon className="size-3.5 shrink-0" />

          <span className="tabular-nums">
            {tally.passing}/{tally.total} checks
          </span>
        </TooltipTrigger>

        <TooltipContent>{getCheckRollupSummary(checks)}</TooltipContent>
      </Tooltip>
    )
  }

  segments.push(
    <ReviewerBar
      key="reviewers"
      pullRequest={pullRequest}
    />
  )

  if (files.count > 0) {
    segments.push(
      <span
        className="tabular-nums"
        key="diffstat"
      >
        +{formatNumber(files.additions)} −{formatNumber(files.deletions)}
      </span>,
      <span
        className="tabular-nums"
        key="files"
      >
        {formatNumber(files.count)} {files.count === 1 ? 'file' : 'files'}
      </span>
    )
  }

  if (hasConflicts) {
    segments.push(
      <span
        className="text-status-danger-foreground"
        key="conflicts"
      >
        Conflicts
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
      {segments.map((segment, index) => (
        <Fragment key={segment.key}>
          {index > 0 && (
            <span
              aria-hidden
              className="opacity-40"
            >
              ·
            </span>
          )}

          {segment}
        </Fragment>
      ))}
    </div>
  )
})
