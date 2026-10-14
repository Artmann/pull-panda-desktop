import { getCheckRollup, getCheckTally } from '@/app/components/check-rollup'
import type { Check } from '@/types/pull-request-details'

import type { TaskGroup, TaskGroupKey } from './tasks/task-types'

export type StatusTone = 'danger' | 'neutral' | 'success' | 'warning'

export interface StatusCell {
  detail: string
  key: 'branch' | 'checks' | 'comments' | 'reviews'
  label: string
  tab: 'checks' | 'overview' | 'tasks'
  tone: StatusTone
  value: string
}

export interface StatusSummary {
  cells: StatusCell[]
  tone: StatusTone
}

interface BuildStatusSummaryInput {
  baseName: string
  /** Already reduced to the latest run of each check. */
  checks: Check[]
  taskGroups: TaskGroup[]
}

/**
 * The four answers shown above the tabs. Checks are read straight from the
 * checks so the counts match the Checks tab; everything else is read from the
 * task groups so the strip and the Tasks tab never disagree.
 */
export function buildStatusSummary({
  baseName,
  checks,
  taskGroups
}: BuildStatusSummaryInput): StatusSummary {
  const findGroup = (key: TaskGroupKey): TaskGroup =>
    taskGroups.find((group) => group.key === key) ?? {
      key,
      label: key,
      tasks: []
    }

  const cells = [
    buildChecksCell(checks),
    buildReviewsCell(findGroup('reviews')),
    buildCommentsCell(findGroup('conversations')),
    buildBranchCell(findGroup('branch'), baseName)
  ]

  return { cells, tone: getOverallTone(cells) }
}

function buildChecksCell(checks: Check[]): StatusCell {
  const rollup = getCheckRollup(checks)
  const tally = getCheckTally(checks)
  const base = { key: 'checks', label: 'Checks', tab: 'checks' } as const

  if (rollup === 'none') {
    return {
      ...base,
      detail: 'Nothing runs on this branch',
      tone: 'neutral',
      value: 'No checks'
    }
  }

  if (rollup === 'failing') {
    const detail = joinParts([
      countPart(tally.passing, 'passed'),
      countPart(tally.running, 'running')
    ])

    return {
      ...base,
      detail: detail || `${tally.total.toString()} of ${tally.total.toString()} checks`,
      tone: 'danger',
      value: `${tally.failed.toString()} failing`
    }
  }

  if (rollup === 'running') {
    return {
      ...base,
      detail: `${tally.passing.toString()} of ${tally.total.toString()} passed`,
      tone: 'warning',
      value: `${tally.running.toString()} running`
    }
  }

  const suites = [
    ...new Set(
      checks.map((check) => check.suiteName).filter((name) => name !== null)
    )
  ].sort()

  return {
    ...base,
    detail: suites.length > 0 ? suites.join(', ') : 'All successful',
    tone: 'success',
    value: `${tally.passing.toString()}/${tally.total.toString()} passed`
  }
}

function buildReviewsCell(group: TaskGroup): StatusCell {
  const base = { key: 'reviews', label: 'Reviews', tab: 'tasks' } as const

  const changesRequested = group.tasks.filter(
    (task) => task.kind === 'review-state'
  )
  const waitingOn = group.tasks
    .filter((task) => task.status === 'running')
    .map((task) => task.authorLogin ?? 'reviewer')
  const isApprovalRequired = group.tasks.some(
    (task) => task.severity === 'blocker' && task.kind !== 'review-state'
  )
  const approved = group.tasks.find(
    (task) => task.id === 'review-approved-summary'
  )

  if (changesRequested.length > 0) {
    return {
      ...base,
      detail: changesRequested
        .map((task) => task.authorLogin ?? 'reviewer')
        .join(', '),
      tone: 'danger',
      value: 'Changes requested'
    }
  }

  if (waitingOn.length > 0) {
    return {
      ...base,
      detail: `Waiting on ${waitingOn.join(', ')}`,
      tone: 'warning',
      value: 'Waiting'
    }
  }

  if (isApprovalRequired) {
    return {
      ...base,
      detail: 'No reviewers assigned',
      tone: 'warning',
      value: 'Approval required'
    }
  }

  if (approved) {
    return {
      ...base,
      detail: approved.title.replace(/^Approved /, ''),
      tone: 'success',
      value: 'Approved'
    }
  }

  return {
    ...base,
    detail: 'No reviewers assigned',
    tone: 'neutral',
    value: 'Not required'
  }
}

function buildCommentsCell(group: TaskGroup): StatusCell {
  const threads = group.tasks.filter((task) => task.kind === 'thread')

  if (threads.length === 0) {
    const summary = group.tasks[0]

    return {
      detail: summary?.meta ?? 'No comments yet',
      key: 'comments',
      label: 'Comments',
      tab: 'overview',
      tone: 'success',
      value: 'None open'
    }
  }

  const files = new Set(
    threads
      .map((task) => (task.kind === 'thread' ? task.anchorComment.path : null))
      .filter((path) => path !== null)
  )

  return {
    detail:
      files.size === 0
        ? 'On the conversation'
        : files.size === 1
          ? 'In 1 file'
          : `Across ${files.size.toString()} files`,
    key: 'comments',
    label: 'Comments',
    tab: 'tasks',
    tone: threads.some((task) => task.severity === 'blocker')
      ? 'danger'
      : 'warning',
    value: `${threads.length.toString()} unresolved`
  }
}

function buildBranchCell(group: TaskGroup, baseName: string): StatusCell {
  const base = { key: 'branch', label: 'Branch', tab: 'tasks' } as const
  const ids = new Set(group.tasks.map((task) => task.id))

  if (ids.has('branch-unknown')) {
    return {
      ...base,
      detail: 'Waiting for GitHub',
      tone: 'neutral',
      value: 'Checking'
    }
  }

  if (
    ids.has('requirement-no-conflicts') ||
    ids.has('requirement-merge-conflicts')
  ) {
    return {
      ...base,
      detail: `Conflicts with ${baseName}`,
      tone: 'danger',
      value: 'Has conflicts'
    }
  }

  const blocker = group.tasks.find((task) => task.severity === 'blocker')

  if (blocker) {
    return {
      ...base,
      detail: blocker.title,
      tone: 'danger',
      value: 'Blocked'
    }
  }

  if (ids.has('requirement-behind')) {
    return {
      ...base,
      detail: `Update with ${baseName}`,
      tone: 'warning',
      value: 'Behind'
    }
  }

  return {
    ...base,
    detail: `Up to date with ${baseName}`,
    tone: 'success',
    value: 'No conflicts'
  }
}

function getOverallTone(cells: StatusCell[]): StatusTone {
  if (cells.some((cell) => cell.tone === 'danger')) {
    return 'danger'
  }

  if (cells.some((cell) => cell.tone === 'warning')) {
    return 'warning'
  }

  return 'success'
}

function countPart(count: number, label: string): string | null {
  return count > 0 ? `${count.toString()} ${label}` : null
}

function joinParts(parts: Array<string | null>): string {
  return parts.filter((part) => part !== null).join(' · ')
}
