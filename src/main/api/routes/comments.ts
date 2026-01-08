import { Octokit } from '@octokit/rest'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'

import { getDatabase } from '../../../database'
import { pullRequests, comments, type Comment, type NewComment } from '../../../database/schema'
import { generateId, normalizeCommentBody } from '../../../sync/utils'

export type AppEnv = {
  Variables: {
    token: string
  }
}

interface CreateCommentRequest {
  body: string
  owner: string
  pullNumber: number
  repo: string
  reviewCommentId?: number
}

export const commentsRoute = new Hono<AppEnv>()

commentsRoute.post('/', async (context) => {
  const token = context.get('token')
  const request = await context.req.json<CreateCommentRequest>()

  if (!request.body || !request.owner || !request.repo || !request.pullNumber) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  const database = getDatabase()

  // Look up the pull request to get the local ID
  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repositoryOwner, request.owner),
        eq(pullRequests.repositoryName, request.repo),
        eq(pullRequests.number, request.pullNumber)
      )
    )
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const octokit = new Octokit({ auth: token })

  try {
    if (request.reviewCommentId) {
      const response = await octokit.rest.pulls.createReplyForReviewComment({
        owner: request.owner,
        repo: request.repo,
        pull_number: request.pullNumber,
        comment_id: request.reviewCommentId,
        body: request.body
      })

      const data = response.data
      const now = new Date().toISOString()

      // Find the parent comment to get context
      const parentComment = database
        .select()
        .from(comments)
        .where(eq(comments.gitHubNumericId, request.reviewCommentId))
        .get()

      const newComment: NewComment = {
        id: generateId(),
        gitHubId: data.node_id,
        gitHubNumericId: data.id,
        pullRequestId: pullRequest.id,
        reviewId: parentComment?.reviewId ?? null,
        body: normalizeCommentBody(data.body),
        bodyHtml: data.body_html ?? null,
        path: data.path,
        line: data.line ?? null,
        originalLine: data.original_line ?? null,
        diffHunk: data.diff_hunk ?? null,
        commitId: data.commit_id ?? null,
        originalCommitId: data.original_commit_id ?? null,
        gitHubReviewId: data.pull_request_review_id ? String(data.pull_request_review_id) : null,
        gitHubReviewThreadId: parentComment?.gitHubReviewThreadId ?? null,
        parentCommentGitHubId: parentComment?.gitHubId ?? null,
        userLogin: data.user?.login ?? null,
        userAvatarUrl: data.user?.avatar_url ?? null,
        url: data.html_url,
        gitHubCreatedAt: data.created_at,
        gitHubUpdatedAt: data.updated_at,
        syncedAt: now,
        deletedAt: null
      }

      database.insert(comments).values(newComment).run()

      const createdComment = database
        .select()
        .from(comments)
        .where(eq(comments.id, newComment.id))
        .get() as Comment

      return context.json(createdComment)
    } else {
      const response = await octokit.rest.issues.createComment({
        owner: request.owner,
        repo: request.repo,
        issue_number: request.pullNumber,
        body: request.body
      })

      const data = response.data
      const now = new Date().toISOString()

      const newComment: NewComment = {
        id: generateId(),
        gitHubId: data.node_id,
        gitHubNumericId: data.id,
        pullRequestId: pullRequest.id,
        reviewId: null,
        body: normalizeCommentBody(data.body ?? ''),
        bodyHtml: data.body_html ?? null,
        path: null,
        line: null,
        originalLine: null,
        diffHunk: null,
        commitId: null,
        originalCommitId: null,
        gitHubReviewId: null,
        gitHubReviewThreadId: null,
        parentCommentGitHubId: null,
        userLogin: data.user?.login ?? null,
        userAvatarUrl: data.user?.avatar_url ?? null,
        url: data.html_url,
        gitHubCreatedAt: data.created_at,
        gitHubUpdatedAt: data.updated_at,
        syncedAt: now,
        deletedAt: null
      }

      database.insert(comments).values(newComment).run()

      const createdComment = database
        .select()
        .from(comments)
        .where(eq(comments.id, newComment.id))
        .get() as Comment

      return context.json(createdComment)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to create comment:', error)

    return context.json({ error: message }, 500)
  }
})
