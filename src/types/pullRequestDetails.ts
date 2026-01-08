export interface Review {
  id: string
  gitHubId: string
  pullRequestId: string
  state: string
  body: string | null
  bodyHtml: string | null
  url: string | null
  authorLogin: string | null
  authorAvatarUrl: string | null
  gitHubCreatedAt: string | null
  gitHubSubmittedAt: string | null
  syncedAt: string
}

export interface Comment {
  id: string
  gitHubId: string
  gitHubNumericId: number | null
  pullRequestId: string
  reviewId: string | null
  body: string | null
  bodyHtml: string | null
  path: string | null
  line: number | null
  originalLine: number | null
  diffHunk: string | null
  commitId: string | null
  originalCommitId: string | null
  gitHubReviewId: string | null
  gitHubReviewThreadId: string | null
  parentCommentGitHubId: string | null
  userLogin: string | null
  userAvatarUrl: string | null
  url: string | null
  gitHubCreatedAt: string | null
  gitHubUpdatedAt: string | null
  syncedAt: string
}

export interface CommentReaction {
  id: string
  gitHubId: string
  commentId: string
  pullRequestId: string
  content: string
  userLogin: string | null
  userId: string | null
  syncedAt: string
}

export interface Check {
  id: string
  gitHubId: string
  pullRequestId: string
  name: string
  state: string | null
  conclusion: string | null
  commitSha: string | null
  suiteName: string | null
  durationInSeconds: number | null
  detailsUrl: string | null
  message: string | null
  url: string | null
  gitHubCreatedAt: string | null
  gitHubUpdatedAt: string | null
  syncedAt: string
}

export interface Commit {
  id: string
  gitHubId: string
  pullRequestId: string
  hash: string
  message: string | null
  url: string | null
  authorLogin: string | null
  authorAvatarUrl: string | null
  linesAdded: number | null
  linesRemoved: number | null
  gitHubCreatedAt: string | null
  syncedAt: string
}

export interface ModifiedFile {
  id: string
  pullRequestId: string
  filename: string
  filePath: string
  status: string | null
  additions: number | null
  deletions: number | null
  changes: number | null
  diffHunk: string | null
  syncedAt: string
}

export interface PullRequestDetails {
  checks: Check[]
  comments: Comment[]
  commits: Commit[]
  files: ModifiedFile[]
  reactions: CommentReaction[]
  reviews: Review[]
}
