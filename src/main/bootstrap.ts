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
} from '../types/pull-request'
import type {
  PullRequestDetails,
  Review,
  Comment,
  CommentReaction,
  Check,
  Commit,
  ModifiedFile
} from '../types/pull-request-details'

export interface PendingReview {
  authorAvatarUrl: string | null
  authorLogin: string | null
  body: string | null
  gitHubId: string
  gitHubNumericId: number | null
  id: string
  pullRequestId: string
  state: string
}

export interface BootstrapData {
  pendingReviews: Record<string, PendingReview>
  pullRequestDetails: Record<string, PullRequestDetails>
  pullRequests: PullRequest[]
}

export async function bootstrap(userLogin?: string): Promise<BootstrapData> {
  const database = getDatabase()

  const rows = database.select().from(pullRequests).all()

  // Get comment counts per PR
  const commentRows = database
    .select()
    .from(comments)
    .where(isNull(comments.deletedAt))
    .all()

  const commentCountByPrId = new Map<string, number>()

  for (const comment of commentRows) {
    const count = commentCountByPrId.get(comment.pullRequestId) ?? 0
    commentCountByPrId.set(comment.pullRequestId, count + 1)
  }

  // Get review counts per PR (approvals and changes requested)
  const reviewRows = database
    .select()
    .from(reviews)
    .where(isNull(reviews.deletedAt))
    .all()

  const approvalCountByPrId = new Map<string, number>()
  const changesRequestedCountByPrId = new Map<string, number>()
  const pendingReviews: Record<string, PendingReview> = {}

  for (const review of reviewRows) {
    if (review.state === 'APPROVED') {
      const count = approvalCountByPrId.get(review.pullRequestId) ?? 0
      approvalCountByPrId.set(review.pullRequestId, count + 1)
    } else if (review.state === 'CHANGES_REQUESTED') {
      const count = changesRequestedCountByPrId.get(review.pullRequestId) ?? 0
      changesRequestedCountByPrId.set(review.pullRequestId, count + 1)
    } else if (
      review.state === 'PENDING' &&
      userLogin &&
      review.authorLogin === userLogin
    ) {
      pendingReviews[review.pullRequestId] = {
        authorAvatarUrl: review.authorAvatarUrl,
        authorLogin: review.authorLogin,
        body: review.body,
        gitHubId: review.gitHubId,
        gitHubNumericId: review.gitHubNumericId,
        id: review.id,
        pullRequestId: review.pullRequestId,
        state: review.state
      }
    }
  }

  const parsedPullRequests: PullRequest[] = rows.map((row) => ({
    approvalCount: approvalCountByPrId.get(row.id) ?? 0,
    assignees: row.assignees
      ? (JSON.parse(row.assignees) as PullRequestAssignee[])
      : [],
    authorAvatarUrl: row.authorAvatarUrl,
    authorLogin: row.authorLogin,
    body: row.body,
    bodyHtml: row.bodyHtml,
    changesRequestedCount: changesRequestedCountByPrId.get(row.id) ?? 0,
    closedAt: row.closedAt,
    commentCount: commentCountByPrId.get(row.id) ?? 0,
    createdAt: row.createdAt,
    detailsSyncedAt: row.detailsSyncedAt,
    id: row.id,
    isDraft: row.isDraft,
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

  const pullRequestDetails: Record<string, PullRequestDetails> = {}

  for (const pullRequest of parsedPullRequests) {
    const details = await getPullRequestDetails(pullRequest.id, userLogin)

    if (details) {
      pullRequestDetails[pullRequest.id] = details
    }
  }

  return {
    pendingReviews,
    pullRequestDetails,
    pullRequests: parsedPullRequests
  }
}

export async function getPullRequestDetails(
  pullRequestId: string,
  userLogin?: string
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
    gitHubNumericId: row.gitHubNumericId,
    pullRequestId: row.pullRequestId,
    state: row.state,
    body: row.body,
    bodyHtml: row.bodyHtml,
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
    gitHubNumericId: row.gitHubNumericId,
    pullRequestId: row.pullRequestId,
    reviewId: row.reviewId,
    body: row.body,
    bodyHtml: row.bodyHtml,
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

  const pendingReview = userLogin
    ? (parsedReviews.find(
        (review) =>
          review.state === 'PENDING' && review.authorLogin === userLogin
      ) ?? null)
    : null

  return {
    checks: parsedChecks,
    comments: parsedComments,
    commits: parsedCommits,
    files: parsedFiles,
    pendingReview,
    reactions: parsedReactions,
    reviews: parsedReviews
  }
}
