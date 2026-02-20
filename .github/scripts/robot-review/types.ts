export type Severity = 'critical' | 'major' | 'minor'

export interface Issue {
  description: string
  file: string
  line: number
  severity: Severity
  title: string
}

export interface Review {
  issues: Issue[]
  summary: string
}

export interface ReviewThread {
  comments: {
    nodes: Array<{
      body: string
      databaseId: number
      id: string
      line: number
      path: string
    }>
  }
  id: string
  isResolved: boolean
}

export interface RobotThread {
  commentId: number
  threadId: string
}
