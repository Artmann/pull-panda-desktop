import type { Comment, ReviewThread } from '@/types/pull-request-details'

export type Severity = 'blocker' | 'warning' | 'info' | 'done'

export type TaskGroupKey = 'ci' | 'reviewers' | 'agents'

type TaskKind = 'check' | 'requirement' | 'review-state' | 'thread' | 'simple'

interface BaseTask {
  action?: TaskAction
  authorAvatarUrl?: string | null
  authorLogin?: string | null
  id: string
  kind: TaskKind
  meta?: string
  severity: Severity
  title: string
}

interface TaskAction {
  label: string
  url?: string | null
}

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
