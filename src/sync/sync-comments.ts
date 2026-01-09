import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import {
  comments,
  commentReactions,
  type NewComment,
  type NewCommentReaction
} from '../database/schema'

import { createRestClient } from './rest-client'
import { etagManager } from './etag-manager'
import { generateId, normalizeCommentBody } from './utils'

interface SyncCommentsParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

interface IssueCommentData {
  id: number
  node_id: string
  body: string
  body_html?: string
  html_url: string
  user: {
    login: string
    avatar_url: string
    id: number
  } | null
  created_at: string
  updated_at: string
  reactions?: {
    url: string
    total_count: number
  }
}

interface ReactionData {
  id: number
  node_id: string
  content: string
  user: {
    login: string
    id: number
  } | null
}

export async function syncComments({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncCommentsParams): Promise<void> {
  console.time('syncComments')

  try {
    const client = createRestClient(token)
    const etagKey = {
      endpointType: 'issue_comments',
      resourceId: pullRequestId
    }

    // Look up cached ETag
    const cached = etagManager.get(etagKey)

    // Fetch PR-level comments (issue comments)
    const result = await client.request<IssueCommentData[]>(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner,
        repo: repositoryName,
        issue_number: pullNumber,
        per_page: 100
      },
      { etag: cached?.etag ?? undefined }
    )

    // Skip processing on 304 Not Modified
    if (result.notModified) {
      console.log(`[syncComments] No changes for PR #${pullNumber} (304)`)
      console.timeEnd('syncComments')

      return
    }

    const commentsData = result.data ?? []

    console.log(
      `Found ${commentsData.length} issue comments for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    // Get existing issue comments (those without a path - not review comments)
    const existingComments = database
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.pullRequestId, pullRequestId),
          isNull(comments.deletedAt),
          isNull(comments.path)
        )
      )
      .all()

    const syncedGitHubIds: string[] = []

    for (const commentData of commentsData) {
      const gitHubId = commentData.node_id
      syncedGitHubIds.push(gitHubId)

      const existingComment = existingComments.find(
        (c) => c.gitHubId === gitHubId
      )

      const commentId = existingComment?.id ?? generateId()

      const comment: NewComment = {
        id: commentId,
        gitHubId,
        gitHubNumericId: commentData.id,
        pullRequestId,
        reviewId: null,
        body: normalizeCommentBody(commentData.body),
        bodyHtml: commentData.body_html ?? null,
        path: null,
        line: null,
        originalLine: null,
        diffHunk: null,
        commitId: null,
        originalCommitId: null,
        gitHubReviewId: null,
        gitHubReviewThreadId: null,
        parentCommentGitHubId: null,
        userLogin: commentData.user?.login ?? null,
        userAvatarUrl: commentData.user?.avatar_url ?? null,
        url: commentData.html_url,
        gitHubCreatedAt: commentData.created_at,
        gitHubUpdatedAt: commentData.updated_at,
        syncedAt: now,
        deletedAt: null
      }

      database
        .insert(comments)
        .values(comment)
        .onConflictDoUpdate({
          target: comments.id,
          set: {
            gitHubNumericId: comment.gitHubNumericId,
            body: comment.body,
            bodyHtml: comment.bodyHtml,
            userLogin: comment.userLogin,
            userAvatarUrl: comment.userAvatarUrl,
            url: comment.url,
            gitHubCreatedAt: comment.gitHubCreatedAt,
            gitHubUpdatedAt: comment.gitHubUpdatedAt,
            syncedAt: comment.syncedAt,
            deletedAt: null
          }
        })
        .run()

      // Fetch reactions for this comment if it has any
      if (commentData.reactions && commentData.reactions.total_count > 0) {
        const reactionsResult = await client.request<ReactionData[]>(
          'GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions',
          {
            owner,
            repo: repositoryName,
            comment_id: commentData.id
          }
        )

        const reactionsData = reactionsResult.data ?? []

        for (const reactionData of reactionsData) {
          if (!reactionData.user) {
            continue
          }

          const existingReaction = database
            .select()
            .from(commentReactions)
            .where(eq(commentReactions.gitHubId, reactionData.node_id))
            .get()

          const reaction: NewCommentReaction = {
            id: existingReaction?.id ?? generateId(),
            gitHubId: reactionData.node_id,
            commentId,
            pullRequestId,
            content: reactionData.content,
            userLogin: reactionData.user.login,
            userId: String(reactionData.user.id),
            syncedAt: now,
            deletedAt: null
          }

          database
            .insert(commentReactions)
            .values(reaction)
            .onConflictDoUpdate({
              target: commentReactions.id,
              set: {
                content: reaction.content,
                userLogin: reaction.userLogin,
                userId: reaction.userId,
                syncedAt: reaction.syncedAt,
                deletedAt: null
              }
            })
            .run()
        }
      }
    }

    // Soft delete issue comments that no longer exist
    for (const existingComment of existingComments) {
      if (!syncedGitHubIds.includes(existingComment.gitHubId)) {
        database
          .update(comments)
          .set({ deletedAt: now })
          .where(eq(comments.id, existingComment.id))
          .run()
      }
    }

    // Store the new ETag
    if (result.etag) {
      etagManager.set(etagKey, result.etag, result.lastModified ?? undefined)
    }

    console.timeEnd('syncComments')
  } catch (error) {
    console.timeEnd('syncComments')
    console.error('Error syncing pull request comments:', error)
    throw error
  }
}
