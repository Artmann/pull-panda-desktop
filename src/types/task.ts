export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export type TaskType = 'syncPullRequests' | 'syncPullRequestDetails'

export interface TaskProgress {
  current: number
  total: number
  message?: string
}

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  message?: string
  progress?: TaskProgress
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  metadata?: Record<string, unknown>
}

export interface TaskUpdateEvent {
  task: Task
}
