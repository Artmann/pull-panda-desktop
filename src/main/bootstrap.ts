import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import {
  pullRequests,
  reviews,
  comments,
  commentReactions,
  checks,
  commits,
  modifiedFiles
} from '../database/schema'
import type {
  PullRequest,
  PullRequestLabel,
  PullRequestAssignee
} from '../types/pullRequest'
import type {
  PullRequestDetails,
  Review,
  Comment,
  CommentReaction,
  Check,
  Commit,
  ModifiedFile
} from '../types/pullRequestDetails'

export interface BootstrapData {
  pullRequests: PullRequest[]
}

export async function bootstrap(): Promise<BootstrapData> {
  const database = getDatabase()

  const rows = database.select().from(pullRequests).all()

  const parsedPullRequests: PullRequest[] = rows.map((row) => ({
    assignees: row.assignees
      ? (JSON.parse(row.assignees) as PullRequestAssignee[])
      : [],
    authorAvatarUrl: row.authorAvatarUrl,
    authorLogin: row.authorLogin,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    id: row.id,
    isAssignee: row.isAssignee,
    isAuthor: row.isAuthor,
    isReviewer: row.isReviewer,
    labels: row.labels ? (JSON.parse(row.labels) as PullRequestLabel[]) : [],
    mergedAt: row.mergedAt,
    number: row.number,
    repositoryName: row.repositoryName,
    repositoryOwner: row.repositoryOwner,
    state: row.state as PullRequest['state'],
    syncedAt: row.syncedAt,
    title: row.title,
    updatedAt: row.updatedAt,
    url: row.url
  }))

  return {
    pullRequests: parsedPullRequests
  }
}

export async function getPullRequestDetails(
  pullRequestId: string
): Promise<PullRequestDetails | null> {
  const database = getDatabase()

  const reviewRows = database
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.pullRequestId, pullRequestId), isNull(reviews.deletedAt))
    )
    .all()

  const commentRows = database
    .select()
    .from(comments)
    .where(
      and(eq(comments.pullRequestId, pullRequestId), isNull(comments.deletedAt))
    )
    .all()

  const reactionRows = database
    .select()
    .from(commentReactions)
    .where(
      and(
        eq(commentReactions.pullRequestId, pullRequestId),
        isNull(commentReactions.deletedAt)
      )
    )
    .all()

  const checkRows = database
    .select()
    .from(checks)
    .where(
      and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
    )
    .all()

  const commitRows = database
    .select()
    .from(commits)
    .where(
      and(eq(commits.pullRequestId, pullRequestId), isNull(commits.deletedAt))
    )
    .all()

  const fileRows = database
    .select()
    .from(modifiedFiles)
    .where(
      and(
        eq(modifiedFiles.pullRequestId, pullRequestId),
        isNull(modifiedFiles.deletedAt)
      )
    )
    .all()

  const parsedReviews: Review[] = reviewRows.map((row) => ({
    id: row.id,
    gitHubId: row.gitHubId,
    pullRequestId: row.pullRequestId,
    state: row.state,
    body: row.body,
    url: row.url,
    authorLogin: row.authorLogin,
    authorAvatarUrl: row.authorAvatarUrl,
    gitHubCreatedAt: row.gitHubCreatedAt,
    gitHubSubmittedAt: row.gitHubSubmittedAt,
    syncedAt: row.syncedAt
  }))

  const parsedComments: Comment[] = commentRows.map((row) => ({
    id: row.id,
    gitHubId: row.gitHubId,
    pullRequestId: row.pullRequestId,
    reviewId: row.reviewId,
    body: row.body,
    path: row.path,
    line: row.line,
    originalLine: row.originalLine,
    diffHunk: row.diffHunk,
    commitId: row.commitId,
    originalCommitId: row.originalCommitId,
    gitHubReviewId: row.gitHubReviewId,
    gitHubReviewThreadId: row.gitHubReviewThreadId,
    parentCommentGitHubId: row.parentCommentGitHubId,
    userLogin: row.userLogin,
    userAvatarUrl: row.userAvatarUrl,
    url: row.url,
    gitHubCreatedAt: row.gitHubCreatedAt,
    gitHubUpdatedAt: row.gitHubUpdatedAt,
    syncedAt: row.syncedAt
  }))

  const parsedReactions: CommentReaction[] = reactionRows.map((row) => ({
    id: row.id,
    gitHubId: row.gitHubId,
    commentId: row.commentId,
    pullRequestId: row.pullRequestId,
    content: row.content,
    userLogin: row.userLogin,
    userId: row.userId,
    syncedAt: row.syncedAt
  }))

  const parsedChecks: Check[] = checkRows.map((row) => ({
    id: row.id,
    gitHubId: row.gitHubId,
    pullRequestId: row.pullRequestId,
    name: row.name,
    state: row.state,
    conclusion: row.conclusion,
    commitSha: row.commitSha,
    suiteName: row.suiteName,
    durationInSeconds: row.durationInSeconds,
    detailsUrl: row.detailsUrl,
    message: row.message,
    url: row.url,
    gitHubCreatedAt: row.gitHubCreatedAt,
    gitHubUpdatedAt: row.gitHubUpdatedAt,
    syncedAt: row.syncedAt
  }))

  const parsedCommits: Commit[] = commitRows.map((row) => ({
    id: row.id,
    gitHubId: row.gitHubId,
    pullRequestId: row.pullRequestId,
    hash: row.hash,
    message: row.message,
    url: row.url,
    authorLogin: row.authorLogin,
    authorAvatarUrl: row.authorAvatarUrl,
    linesAdded: row.linesAdded,
    linesRemoved: row.linesRemoved,
    gitHubCreatedAt: row.gitHubCreatedAt,
    syncedAt: row.syncedAt
  }))

  const parsedFiles: ModifiedFile[] = fileRows.map((row) => ({
    id: row.id,
    pullRequestId: row.pullRequestId,
    filename: row.filename,
    filePath: row.filePath,
    status: row.status,
    additions: row.additions,
    deletions: row.deletions,
    changes: row.changes,
    diffHunk: row.diffHunk,
    syncedAt: row.syncedAt
  }))

  return {
    checks: parsedChecks,
    comments: parsedComments,
    commits: parsedCommits,
    files: parsedFiles,
    reactions: parsedReactions,
    reviews: parsedReviews
  }
}
