import { useMemo } from 'react'
import { shallowEqual } from 'react-redux'

import type { MergeOptions } from '@/app/lib/api'
import { useAppSelector } from '@/app/store/hooks'
import type {
  Check,
  Comment,
  Review,
  ReviewThread
} from '@/types/pull-request-details'

import { getLatestReviews } from '../get-latest-reviews'
import { isBotAuthor } from './bot-detection'
import type {
  CheckTask,
  RequirementTask,
  ReviewStateTask,
  Severity,
  SimpleTask,
  Task,
  TaskGroup,
  ThreadTask
} from './task-types'

const failureConclusions = new Set([
  'failure',
  'error',
  'startup_failure',
  'timed_out',
  'action_required'
])

const runningStates = new Set(['queued', 'in_progress', 'pending'])

interface BuildTaskGroupsInput {
  checks: Check[]
  comments: Comment[]
  mergeOptions: MergeOptions | null
  reviewThreads: ReviewThread[]
  reviews: Review[]
}

export function buildTaskGroups({
  checks,
  comments,
  mergeOptions,
  reviewThreads,
  reviews
}: BuildTaskGroupsInput): TaskGroup[] {
  return [
    buildCiGroup({ checks, mergeOptions }),
    buildReviewersGroup({ comments, reviewThreads, reviews }),
    buildAgentsGroup({ comments, reviewThreads })
  ]
}

function buildCiGroup({
  checks,
  mergeOptions
}: {
  checks: Check[]
  mergeOptions: MergeOptions | null
}): TaskGroup {
  const dedupedChecks = dedupeChecksByName(checks)

  const { passedCount, tasks } = buildCheckTasks(dedupedChecks)

  pushMergeRequirementTasks(tasks, mergeOptions)

  if (passedCount > 0 && !tasks.some((task) => task.severity === 'blocker')) {
    const doneTask: SimpleTask = {
      id: 'check-summary-passed',
      kind: 'simple',
      meta: `${passedCount.toString()} of ${dedupedChecks.length.toString()} required checks`,
      severity: 'done',
      title: 'All checks have passed'
    }

    tasks.push(doneTask)
  }

  return {
    key: 'ci',
    label: 'CI & automation',
    tasks
  }
}

function buildCheckTasks(checks: Check[]): {
  passedCount: number
  tasks: Task[]
} {
  const tasks: Task[] = []
  let passedCount = 0

  for (const check of checks) {
    const conclusion = check.conclusion?.toLowerCase() ?? null
    const state = check.state?.toLowerCase() ?? null

    if (conclusion && failureConclusions.has(conclusion)) {
      tasks.push(buildFailedCheckTask(check, conclusion))
      continue
    }

    if (state && runningStates.has(state)) {
      tasks.push(buildRunningCheckTask(check))
      continue
    }

    if (isPassedCheck(conclusion, state)) {
      passedCount++
    }
  }

  return { passedCount, tasks }
}

function buildFailedCheckTask(check: Check, conclusion: string): CheckTask {
  const url = check.detailsUrl ?? check.url

  const task: CheckTask = {
    detailsUrl: check.detailsUrl ?? check.url ?? null,
    id: `check-${check.id}`,
    kind: 'check',
    message: check.message,
    meta: check.suiteName
      ? `${check.suiteName} · ${humanizeConclusion(conclusion)}`
      : humanizeConclusion(conclusion),
    severity: 'blocker',
    title: check.name
  }

  if (url) {
    task.action = { label: 'View details', url }
  }

  return task
}

function buildRunningCheckTask(check: Check): SimpleTask {
  return {
    id: `check-${check.id}`,
    kind: 'simple',
    meta: check.suiteName ? `${check.suiteName} · running` : 'Running',
    severity: 'warning',
    title: check.name
  }
}

function isPassedCheck(
  conclusion: string | null,
  state: string | null
): boolean {
  return (
    conclusion === 'success' ||
    conclusion === 'neutral' ||
    conclusion === 'skipped' ||
    state === 'completed'
  )
}

const requirementActionTitles: Record<string, string> = {
  'approving-reviews': 'Get required approvals',
  'no-conflicts': 'Resolve merge conflicts',
  'not-draft': 'Mark pull request as ready for review',
  'required-checks': 'Pass required checks'
}

function pushMergeRequirementTasks(
  tasks: Task[],
  mergeOptions: MergeOptions | null
): void {
  if (!mergeOptions) {
    return
  }

  const hasConflictRequirement = mergeOptions.requirements.some(
    (requirement) => requirement.key === 'no-conflicts'
  )

  for (const requirement of mergeOptions.requirements) {
    if (requirement.satisfied) {
      continue
    }

    const requirementTask: RequirementTask = {
      description: requirement.description,
      id: `requirement-${requirement.key}`,
      kind: 'requirement',
      meta: 'Branch protection requirement',
      severity: 'blocker',
      title: requirementActionTitles[requirement.key] ?? requirement.label
    }

    tasks.push(requirementTask)
  }

  if (mergeOptions.mergeableState === 'dirty' && !hasConflictRequirement) {
    tasks.push({
      description:
        'This branch has conflicts with the base branch that must be resolved before it can be merged.',
      id: 'requirement-merge-conflicts',
      kind: 'requirement',
      meta: 'Branch state',
      severity: 'blocker',
      title: 'Resolve merge conflicts'
    })
  }
}

function buildReviewersGroup({
  comments,
  reviewThreads,
  reviews
}: {
  comments: Comment[]
  reviewThreads: ReviewThread[]
  reviews: Review[]
}): TaskGroup {
  const humanReviews = reviews.filter(
    (review) => !isBotAuthor(review.authorLogin)
  )

  const latestReviews = getLatestReviews(humanReviews)

  const { approvedCount, hasChangesRequested, tasks } =
    buildReviewStateTasks(latestReviews)

  const threadSeverity: Severity = hasChangesRequested ? 'blocker' : 'info'

  for (const thread of reviewThreads) {
    const threadTask = buildHumanThreadTask(thread, comments, threadSeverity)

    if (threadTask) {
      tasks.push(threadTask)
    }
  }

  if (approvedCount > 0) {
    tasks.push(buildApprovedSummary(approvedCount))
  }

  return {
    key: 'reviewers',
    label: 'Human reviewers',
    tasks
  }
}

function buildReviewStateTasks(reviews: Review[]): {
  approvedCount: number
  hasChangesRequested: boolean
  tasks: Task[]
} {
  const tasks: Task[] = []
  let approvedCount = 0
  let hasChangesRequested = false

  for (const review of reviews) {
    if (review.state === 'CHANGES_REQUESTED') {
      hasChangesRequested = true
      tasks.push(buildChangesRequestedTask(review))
      continue
    }

    if (review.state === 'APPROVED') {
      approvedCount++
    }
  }

  return { approvedCount, hasChangesRequested, tasks }
}

function buildChangesRequestedTask(review: Review): ReviewStateTask {
  return {
    authorAvatarUrl: review.authorAvatarUrl,
    authorLogin: review.authorLogin,
    id: `review-state-${review.id}`,
    kind: 'review-state',
    meta: 'Required reviewer · changes requested',
    severity: 'blocker',
    summary:
      'Address the requested changes and re-request review to clear the changes-requested state.',
    title: `${review.authorLogin ?? 'Reviewer'} requested changes`
  }
}

function buildHumanThreadTask(
  thread: ReviewThread,
  comments: Comment[],
  severity: Severity
): ThreadTask | null {
  const anchor = findThreadAnchor(thread, comments)

  if (!anchor || isBotAuthor(anchor.userLogin) || thread.isResolved) {
    return null
  }

  return buildThreadTask(thread, anchor, severity)
}

function buildApprovedSummary(approvedCount: number): SimpleTask {
  return {
    id: 'review-approved-summary',
    kind: 'simple',
    meta: 'Latest reviews',
    severity: 'done',
    title:
      approvedCount === 1
        ? '1 reviewer approved'
        : `${approvedCount.toString()} reviewers approved`
  }
}

function buildThreadTask(
  thread: ReviewThread,
  anchor: Comment,
  severity: Severity
): ThreadTask {
  return {
    anchorComment: anchor,
    authorAvatarUrl: anchor.userAvatarUrl,
    authorLogin: anchor.userLogin,
    id: `thread-${thread.id}`,
    kind: 'thread',
    meta: anchor.path
      ? `${anchor.path}${anchor.line ? `:${anchor.line.toString()}` : ''}`
      : undefined,
    severity,
    thread,
    title: buildThreadTitle(anchor)
  }
}

function buildAgentsGroup({
  comments,
  reviewThreads
}: {
  comments: Comment[]
  reviewThreads: ReviewThread[]
}): TaskGroup {
  const tasks: Task[] = []

  for (const thread of reviewThreads) {
    const anchor = findThreadAnchor(thread, comments)

    if (!anchor || !isBotAuthor(anchor.userLogin) || thread.isResolved) {
      continue
    }

    tasks.push(buildThreadTask(thread, anchor, 'info'))
  }

  return {
    key: 'agents',
    label: 'AI agents & bots',
    tasks
  }
}

function dedupeChecksByName(checks: Check[]): Check[] {
  const byName = new Map<string, Check>()

  for (const check of checks) {
    const existing = byName.get(check.name)

    if (!existing || new Date(check.syncedAt) > new Date(existing.syncedAt)) {
      byName.set(check.name, check)
    }
  }

  return Array.from(byName.values())
}

function findThreadAnchor(
  thread: ReviewThread,
  comments: Comment[]
): Comment | null {
  return (
    comments.find(
      (comment) =>
        comment.gitHubReviewThreadId === thread.gitHubId &&
        !comment.parentCommentGitHubId
    ) ?? null
  )
}

function buildThreadTitle(comment: Comment): string {
  const author = comment.userLogin ?? 'Reviewer'
  const body = (comment.body ?? '').trim().replace(/\s+/g, ' ')

  if (!body) {
    return `${author} left a comment`
  }

  const truncated = body.length > 96 ? `${body.slice(0, 96)}…` : body

  return `${author}: ${truncated}`
}

function humanizeConclusion(conclusion: string): string {
  if (conclusion === 'failure') {
    return 'Failed'
  }

  if (conclusion === 'startup_failure') {
    return 'Startup failure'
  }

  if (conclusion === 'timed_out') {
    return 'Timed out'
  }

  if (conclusion === 'action_required') {
    return 'Action required'
  }

  if (conclusion === 'error') {
    return 'Error'
  }

  return conclusion
}

export function countOpenBlockers(groups: TaskGroup[]): number {
  let count = 0

  for (const group of groups) {
    for (const task of group.tasks) {
      if (task.severity === 'blocker') {
        count++
      }
    }
  }

  return count
}

export function useDerivedTaskGroups(pullRequestId: string): TaskGroup[] {
  const checks = useAppSelector(
    (state) =>
      state.checks.items.filter(
        (check) => check.pullRequestId === pullRequestId
      ),
    shallowEqual
  )

  const comments = useAppSelector(
    (state) =>
      state.comments.items.filter(
        (comment) => comment.pullRequestId === pullRequestId
      ),
    shallowEqual
  )

  const reviews = useAppSelector(
    (state) =>
      state.reviews.items.filter(
        (review) => review.pullRequestId === pullRequestId
      ),
    shallowEqual
  )

  const reviewThreads = useAppSelector(
    (state) =>
      state.reviewThreads.items.filter(
        (thread) => thread.pullRequestId === pullRequestId
      ),
    shallowEqual
  )

  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequestId] ?? null
  )

  return useMemo(
    () =>
      buildTaskGroups({
        checks,
        comments,
        mergeOptions,
        reviewThreads,
        reviews
      }),
    [checks, comments, mergeOptions, reviewThreads, reviews]
  )
}
