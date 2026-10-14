import type { Comment, ReviewThread } from '@/types/pull-request-details'

export type Severity = 'blocker' | 'warning' | 'info' | 'done'

export type TaskGroupKey = 'checks' | 'reviews' | 'conversations' | 'branch'

type TaskKind = 'check' | 'requirement' | 'review-state' | 'thread' | 'simple'

interface BaseTask {
  action?: TaskAction
  authorAvatarUrl?: string | null
  authorLogin?: string | null
  id: string
  kind: TaskKind
  meta?: string
  severity: Severity
  /**
   * How the row reads, when severity alone would mislead: `running` for work
   * in progress, `pending` for a blocker that is waiting to happen rather than
   * something that went wrong, such as an approval nobody has given yet.
   */
  status?: 'pending' | 'running'
  title: string
}

/**
 * The button on the right of a row. Most open a page on GitHub; picking
 * reviewers and resolving a thread happen in place.
 */
export type TaskAction =
  | { label: string; type: 'open-url'; url: string }
  | { type: 'assign-reviewers' }
  | { type: 'resolve-thread' }

export interface CheckTask extends BaseTask {
  detailsUrl: string | null
  kind: 'check'
  message: string | null
}

export interface RequirementTask extends BaseTask {
  description: string
  kind: 'requirement'
}

export interface ReviewStateTask extends BaseTask {
  kind: 'review-state'
  summary: string
}

export interface ThreadTask extends BaseTask {
  anchorComment: Comment
  kind: 'thread'
  thread: ReviewThread | null
}

export interface SimpleTask extends BaseTask {
  kind: 'simple'
}

export type Task =
  | CheckTask
  | RequirementTask
  | ReviewStateTask
  | ThreadTask
  | SimpleTask

export interface TaskGroup {
  key: TaskGroupKey
  label: string
  tasks: Task[]
}

export type TasksFilter = 'all' | 'open' | 'blockers'
