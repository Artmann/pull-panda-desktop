import { useMemo } from 'react'
import { shallowEqual } from 'react-redux'

import { getLatestChecks } from '@/app/components/check-rollup'
import type { MergeOptions } from '@/app/lib/api'
import { firstPlainLine } from '@/app/lib/plain-text'
import { useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'
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

type TaskPullRequest = Pick<
  PullRequest,
  'baseRefName' | 'requestedReviewers' | 'reviewDecision'
>

interface BuildTaskGroupsInput {
  checks: Check[]
  comments: Comment[]
  commitCount: number
  mergeOptions: MergeOptions | null
  pullRequest: TaskPullRequest
  reviewThreads: ReviewThread[]
  reviews: Review[]
}

/**
 * Splits everything standing between a pull request and a merge into the four
 * questions a reviewer asks: do the checks pass, has it been reviewed, is any
 * conversation still open, and will the branch merge. Every group ends with a
 * done row when nothing is wrong, so each question always has an answer.
 */
export function buildTaskGroups({
  checks,
  comments,
  commitCount,
  mergeOptions,
  pullRequest,
  reviewThreads,
  reviews
}: BuildTaskGroupsInput): TaskGroup[] {
  const baseName = pullRequest.baseRefName ?? 'the base branch'
  const humanReviews = getLatestReviews(
    reviews.filter((review) => !isBotAuthor(review.authorLogin))
  )
  const hasChangesRequested = humanReviews.some(
    (review) => review.state === 'CHANGES_REQUESTED'
  )

  return [
    buildChecksGroup(checks),
    buildReviewsGroup({
      baseName,
      latestReviews: humanReviews,
      mergeOptions,
      pullRequest
    }),
    buildConversationsGroup({ comments, hasChangesRequested, reviewThreads }),
    buildBranchGroup({ baseName, commitCount, mergeOptions })
  ]
}

function buildChecksGroup(checks: Check[]): TaskGroup {
  const dedupedChecks = getLatestChecks(checks)
  const tasks: Task[] = []
  const passedNames: string[] = []

  for (const check of dedupedChecks) {
    const task = buildCheckTask(check)

    if (task) {
      tasks.push(task)
    } else if (isPassedCheck(check)) {
      passedNames.push(check.name)
    }
  }

  if (dedupedChecks.length === 0) {
    tasks.push({
      id: 'check-summary-none',
      kind: 'simple',
      meta: 'Nothing runs on this branch',
      severity: 'done',
      title: 'No checks'
    })
  } else if (passedNames.length > 0) {
    tasks.push(buildPassedChecksTask(passedNames, dedupedChecks.length))
  }

  return { key: 'checks', label: 'Checks', tasks }
}

function buildPassedChecksTask(
  passedNames: string[],
  totalCount: number
): SimpleTask {
  const passedCount = passedNames.length

  if (passedCount === totalCount) {
    return {
      id: 'check-summary-passed',
      kind: 'simple',
      meta: `${passedCount.toString()} of ${totalCount.toString()} successful`,
      severity: 'done',
      title: 'All checks passed'
    }
  }

  return {
    id: 'check-summary-passed',
    kind: 'simple',
    meta: [...passedNames].sort().join(', '),
    severity: 'done',
    title:
      passedCount === 1
        ? '1 other check passed'
        : `${passedCount.toString()} other checks passed`
  }
}

function buildFailedCheckTask(check: Check, conclusion: string): CheckTask {
  const url = check.detailsUrl ?? check.url
  const suffix = check.suiteName
    ? `${check.suiteName} · ${humanizeConclusion(conclusion)}`
    : humanizeConclusion(conclusion)

  const task: CheckTask = {
    detailsUrl: url ?? null,
    id: `check-${check.id}`,
    kind: 'check',
    message: check.message,
    meta: firstPlainLine(check.message) ?? suffix,
    severity: 'blocker',
    title: `${check.name} is failing`
  }

  if (url) {
    task.action = { label: 'View logs', type: 'open-url', url }
  }

  return task
}

function buildRunningCheckTask(check: Check): SimpleTask {
  return {
    id: `check-${check.id}`,
    kind: 'simple',
    meta: check.suiteName ? `${check.suiteName} · running` : 'Running',
    severity: 'info',
    status: 'running',
    title: `${check.name} is still running`
  }
}

/** A row for a check that still needs attention, or null when it is done. */
function buildCheckTask(check: Check): Task | null {
  const conclusion = check.conclusion?.toLowerCase() ?? null
  const state = check.state?.toLowerCase() ?? null

  if (conclusion && failureConclusions.has(conclusion)) {
    return buildFailedCheckTask(check, conclusion)
  }

  if (state && runningStates.has(state)) {
    return buildRunningCheckTask(check)
  }

  return null
}

const passedConclusions = new Set(['neutral', 'skipped', 'success'])

function isPassedCheck(check: Check): boolean {
  return (
    passedConclusions.has(check.conclusion?.toLowerCase() ?? '') ||
    check.state?.toLowerCase() === 'completed'
  )
}

function buildReviewsGroup({
  baseName,
  latestReviews,
  mergeOptions,
  pullRequest
}: {
  baseName: string
  latestReviews: Review[]
  mergeOptions: MergeOptions | null
  pullRequest: TaskPullRequest
}): TaskGroup {
  const approvers = latestReviews
    .filter((review) => review.state === 'APPROVED')
    .map((review) => review.authorLogin ?? 'Reviewer')
  const reviewedLogins = new Set(
    latestReviews
      .map((review) => review.authorLogin)
      .filter((login) => login !== null)
  )

  const tasks: Task[] = [
    ...latestReviews
      .filter((review) => review.state === 'CHANGES_REQUESTED')
      .map(buildChangesRequestedTask),
    ...buildApprovalRequiredTasks({
      baseName,
      hasApprovals: approvers.length > 0,
      mergeOptions,
      reviewDecision: pullRequest.reviewDecision
    }),
    ...pullRequest.requestedReviewers
      .filter((reviewer) => !reviewedLogins.has(reviewer.login))
      .map(
        (reviewer): SimpleTask => ({
          authorAvatarUrl: reviewer.avatarUrl,
          authorLogin: reviewer.login,
          id: `review-waiting-${reviewer.login}`,
          kind: 'simple',
          meta: 'Review requested',
          severity: 'info',
          status: 'running',
          title: `Waiting on ${reviewer.login}`
        })
      )
  ]

  if (approvers.length > 0) {
    tasks.push({
      id: 'review-approved-summary',
      kind: 'simple',
      meta: 'Latest reviews',
      severity: 'done',
      title: `Approved by ${formatList(approvers)}`
    })
  }

  if (tasks.length === 0) {
    tasks.push({
      action: { type: 'assign-reviewers' },
      id: 'review-none',
      kind: 'simple',
      meta: `Branch protection on ${baseName} does not require approvals`,
      severity: 'done',
      title: 'No review required'
    })
  }

  return { key: 'reviews', label: 'Reviews', tasks }
}

/**
 * Branch protection's approval rule, when it is unmet. Merge options say so
 * directly; before they load, GitHub's review decision is the fallback.
 */
function buildApprovalRequiredTasks({
  baseName,
  hasApprovals,
  mergeOptions,
  reviewDecision
}: {
  baseName: string
  hasApprovals: boolean
  mergeOptions: MergeOptions | null
  reviewDecision: string | null
}): Task[] {
  const meta = `Required by branch protection on ${baseName}`
  const requirement = mergeOptions?.requirements.find(
    (candidate) => candidate.key === 'approving-reviews' && !candidate.satisfied
  )

  // GitHub's description says what the rule is waiting for, which is the one
  // thing worth reading here, so it is the second line rather than an
  // expansion with nothing else in it.
  if (requirement) {
    return [
      {
        id: 'requirement-approving-reviews',
        kind: 'simple',
        meta: requirement.description || meta,
        severity: 'blocker',
        status: 'pending',
        title: requirement.label
      }
    ]
  }

  if (reviewDecision === 'REVIEW_REQUIRED' && !hasApprovals) {
    return [
      {
        id: 'review-required',
        kind: 'simple',
        meta,
        severity: 'blocker',
        status: 'pending',
        title: 'Approval required'
      }
    ]
  }

  return []
}

function buildChangesRequestedTask(review: Review): ReviewStateTask {
  const author = review.authorLogin ?? 'a reviewer'

  const task: ReviewStateTask = {
    authorAvatarUrl: review.authorAvatarUrl,
    authorLogin: review.authorLogin,
    id: `review-state-${review.id}`,
    kind: 'review-state',
    meta: 'Address the feedback, then re-request a review',
    severity: 'blocker',
    summary:
      'Address the requested changes and re-request review to clear the changes-requested state.',
    title: `Changes requested by ${author}`
  }

  if (review.url) {
    task.action = { label: 'Open', type: 'open-url', url: review.url }
  }

  return task
}

function buildConversationsGroup({
  comments,
  hasChangesRequested,
  reviewThreads
}: {
  comments: Comment[]
  hasChangesRequested: boolean
  reviewThreads: ReviewThread[]
}): TaskGroup {
  const tasks: Task[] = []

  for (const thread of reviewThreads) {
    const anchor = findThreadAnchor(thread, comments)

    if (!anchor || thread.isResolved || isCommentOutdated(anchor)) {
      continue
    }

    // A human thread holds up the merge once its author has asked for
    // changes; until then it, like every bot suggestion, is something to read.
    const severity: Severity =
      hasChangesRequested && !isBotAuthor(anchor.userLogin) ? 'blocker' : 'info'

    tasks.push(buildThreadTask(thread, anchor, severity))
  }

  if (tasks.length === 0) {
    tasks.push({
      id: 'conversation-summary',
      kind: 'simple',
      meta: describeCommentCount(comments),
      severity: 'done',
      title: 'No unresolved threads'
    })
  }

  return { key: 'conversations', label: 'Conversations', tasks }
}

function describeCommentCount(comments: Comment[]): string {
  const topLevel = comments.filter((comment) => !comment.parentCommentGitHubId)

  if (topLevel.length === 0) {
    return 'No comments yet'
  }

  const botCount = topLevel.filter((comment) =>
    isBotAuthor(comment.userLogin)
  ).length

  if (botCount === topLevel.length) {
    return botCount === 1
      ? '1 bot comment'
      : `${botCount.toString()} bot comments`
  }

  return topLevel.length === 1
    ? '1 comment'
    : `${topLevel.length.toString()} comments`
}

function isCommentOutdated(comment: Comment): boolean {
  return comment.path !== null && comment.line === null
}

function buildThreadTask(
  thread: ReviewThread,
  anchor: Comment,
  severity: Severity
): ThreadTask {
  const location = anchor.path
    ? `${anchor.path}${anchor.line ? `:${anchor.line.toString()}` : ''}`
    : null
  const author = anchor.userLogin ?? 'Reviewer'

  return {
    action: { type: 'resolve-thread' },
    anchorComment: anchor,
    authorAvatarUrl: anchor.userAvatarUrl,
    authorLogin: anchor.userLogin,
    id: `thread-${thread.id}`,
    kind: 'thread',
    meta: location ? `${location} · ${author}` : author,
    severity,
    thread,
    title: buildThreadTitle(anchor)
  }
}

const requirementTitles: Record<string, string> = {
  'no-conflicts': 'Resolve merge conflicts',
  'not-draft': 'Mark pull request as ready for review'
}

// Requirements the other groups already answer.
const requirementsHandledElsewhere = new Set([
  'approving-reviews',
  'required-checks'
])

function buildBranchGroup({
  baseName,
  commitCount,
  mergeOptions
}: {
  baseName: string
  commitCount: number
  mergeOptions: MergeOptions | null
}): TaskGroup {
  if (!mergeOptions) {
    return {
      key: 'branch',
      label: 'Branch',
      tasks: [
        {
          id: 'branch-unknown',
          kind: 'simple',
          meta: 'Waiting for GitHub to report the merge state',
          severity: 'info',
          title: 'Checking for conflicts'
        }
      ]
    }
  }

  const tasks: Task[] = buildBranchRequirementTasks(mergeOptions)
  const isBehind = mergeOptions.mergeableState === 'behind'
  const isDirty = mergeOptions.mergeableState === 'dirty'

  if (
    isDirty &&
    !tasks.some((task) => task.id === 'requirement-no-conflicts')
  ) {
    tasks.push({
      description:
        'This branch has conflicts with the base branch that must be resolved before it can be merged.',
      id: 'requirement-merge-conflicts',
      kind: 'requirement',
      meta: `Conflicts with ${baseName}`,
      severity: 'blocker',
      title: 'Resolve merge conflicts'
    })
  }

  if (isBehind) {
    tasks.push({
      description: `${baseName} has moved on since this branch was created. Update the branch to bring in the latest changes.`,
      id: 'requirement-behind',
      kind: 'requirement',
      meta: 'Update the branch before merging',
      severity: 'warning',
      title: `Behind ${baseName}`
    })
  }

  if (mergeOptions.mergeable !== false && !isDirty) {
    const commits =
      commitCount === 1 ? '1 commit' : `${commitCount.toString()} commits`

    tasks.push({
      id: 'branch-no-conflicts',
      kind: 'simple',
      meta: `${isBehind ? 'Behind' : 'Up to date'} · ${commits}`,
      severity: 'done',
      title: `No conflicts with ${baseName}`
    })
  }

  return { key: 'branch', label: 'Branch', tasks }
}

function buildBranchRequirementTasks(mergeOptions: MergeOptions): Task[] {
  return mergeOptions.requirements
    .filter(
      (requirement) =>
        !requirement.satisfied &&
        !requirementsHandledElsewhere.has(requirement.key)
    )
    .map(
      (requirement): RequirementTask => ({
        description: requirement.description,
        id: `requirement-${requirement.key}`,
        kind: 'requirement',
        meta: 'Branch protection requirement',
        severity: 'blocker',
        title: requirementTitles[requirement.key] ?? requirement.label
      })
    )
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

// Comments are markdown, and bots in particular lead with bold and code
// spans, so the title is the first line as it reads, not as it is written.
function buildThreadTitle(comment: Comment): string {
  const line = firstPlainLine(comment.body)

  if (!line) {
    return `${comment.userLogin ?? 'Reviewer'} left a comment`
  }

  return line.length > 96 ? `${line.slice(0, 96)}…` : line
}

function formatList(names: string[]): string {
  if (names.length <= 2) {
    return names.join(' and ')
  }

  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
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

export function useDerivedTaskGroups(
  pullRequest: TaskPullRequest & { id: string }
): TaskGroup[] {
  const pullRequestId = pullRequest.id

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

  const commitCount = useAppSelector(
    (state) =>
      state.commits.items.filter(
        (commit) => commit.pullRequestId === pullRequestId
      ).length
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

  const { baseRefName, requestedReviewers, reviewDecision } = pullRequest

  return useMemo(
    () =>
      buildTaskGroups({
        checks,
        comments,
        commitCount,
        mergeOptions,
        pullRequest: { baseRefName, requestedReviewers, reviewDecision },
        reviewThreads,
        reviews
      }),
    [
      baseRefName,
      checks,
      comments,
      commitCount,
      mergeOptions,
      requestedReviewers,
      reviewDecision,
      reviewThreads,
      reviews
    ]
  )
}
