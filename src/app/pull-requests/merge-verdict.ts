import type { MergeOptions } from '@/app/lib/api'

import { canMergeNow } from './merge-button-label'
import type { StatusSummary, StatusTone } from './status-summary'
import type { TaskGroup } from './tasks/task-types'

export interface MergeVerdict {
  /** How many open tasks stand between the pull request and a merge. */
  blockerCount: number
  detail: string
  title: string
  tone: StatusTone
}

const waitingReasons: Record<string, string> = {
  branch: 'the branch is behind',
  checks: 'checks are still running',
  comments: 'conversations are still open',
  reviews: 'a review is outstanding'
}

/**
 * The one-line answer at the top of the merge drawer. It leans on the same
 * status summary as the strip under the title, but GitHub's merge state has
 * the final word: a pull request it refuses to merge is never "ready".
 */
export function getMergeVerdict({
  mergeOptions,
  summary,
  taskGroups
}: {
  mergeOptions: MergeOptions | null
  summary: StatusSummary
  taskGroups: TaskGroup[]
}): MergeVerdict {
  const blockerCount = taskGroups
    .flatMap((group) => group.tasks)
    .filter((task) => task.severity === 'blocker').length

  if (!mergeOptions || mergeOptions.mergeable === null) {
    return {
      blockerCount,
      detail: 'GitHub is working out whether this can merge.',
      title: 'Checking',
      tone: 'neutral'
    }
  }

  const automationVerdict = getAutomationVerdict(mergeOptions, blockerCount)

  if (automationVerdict) {
    return automationVerdict
  }

  if (
    summary.tone === 'danger' ||
    (blockerCount > 0 && summary.tone !== 'warning')
  ) {
    return {
      blockerCount,
      detail:
        blockerCount === 1
          ? '1 thing to fix before merging.'
          : `${blockerCount.toString()} things to fix before merging.`,
      title: 'Needs changes',
      tone: 'danger'
    }
  }

  if (summary.tone === 'warning') {
    const reasons = summary.cells
      .filter((cell) => cell.tone === 'warning')
      .map((cell) => waitingReasons[cell.key])

    return {
      blockerCount,
      detail: `${capitalize(reasons.join(' and '))}.`,
      title: 'Waiting',
      tone: 'warning'
    }
  }

  if (!canMergeNow(mergeOptions)) {
    return {
      blockerCount,
      detail: 'GitHub is not allowing this merge yet.',
      title: 'Blocked',
      tone: 'danger'
    }
  }

  return {
    blockerCount,
    detail: 'Checks passed, no open conversations, no conflicts.',
    title: 'Ready to merge',
    tone: 'success'
  }
}

// Once the pull request is on its way in, that is the answer, whatever is
// still pending: GitHub merges it when the rest is done.
function getAutomationVerdict(
  mergeOptions: MergeOptions,
  blockerCount: number
): MergeVerdict | null {
  if (mergeOptions.mergeQueueEntry) {
    const position = mergeOptions.mergeQueueEntry.position

    return {
      blockerCount,
      detail:
        position === null
          ? 'GitHub is adding it to the queue.'
          : `Number ${position.toString()} in the queue.`,
      title: 'In merge queue',
      tone: 'neutral'
    }
  }

  if (!mergeOptions.autoMergeRequest) {
    return null
  }

  const isQueue = mergeOptions.isMergeQueueEnabled

  return {
    blockerCount,
    detail: isQueue
      ? 'Joins the merge queue once every rule is met.'
      : 'Merges once every rule is met.',
    title: isQueue ? 'Merge when ready' : 'Auto-merge enabled',
    tone: 'neutral'
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
