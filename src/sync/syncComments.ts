import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import {
  comments,
  commentReactions,
  type NewComment,
  type NewCommentReaction
} from '../database/schema'

import { createGraphqlClient } from './graphql'
import { commentsQuery, type CommentsQueryResponse } from './queries'
import {
  generateId,
  normalizeCommentBody,
  getLineTypeFromDiffHunk
} from './utils'

interface SyncCommentsParams {
  client: ReturnType<typeof createGraphqlClient>
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

interface GitHubCommentData {
  id: string
  body?: string
  bodyHTML?: string
  createdAt?: string
  updatedAt?: string
  url?: string
  path?: string
  line?: number
  originalLine?: number
  diffHunk?: string
  commit?: { oid: string }
  originalCommit?: { oid: string }
  pullRequestReview?: { id: string }
  replyTo?: { id: string }
  reviewThreadId?: string
  author?: {
    login: string
    avatarUrl: string
  }
  reactions: {
    nodes?: Array<{
      id: string
      content: string
      user?: { id: string; login: string }
    } | null> | null
  }
}

export async function syncComments({
  client,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncCommentsParams): Promise<void> {
  console.time('syncComments')

  try {
    const response = await client<CommentsQueryResponse>(commentsQuery, {
      owner,
      repo: repositoryName,
      pullNumber
    })

    const prComments = response.repository?.pullRequest?.comments?.nodes ?? []
    const reviewComments =
      response.repository?.pullRequest?.reviewThreads?.nodes?.flatMap(
        (thread) =>
          thread?.comments?.nodes
            ?.filter((node) => node !== null)
            .map((node) => ({
              ...node,
              reviewThreadId: thread.id
            })) ?? []
      ) ?? []

    const allComments: GitHubCommentData[] = [
      ...prComments.filter((c): c is NonNullable<typeof c> => c !== null),
      ...reviewComments
    ]

    console.log(
      `Found ${allComments.length} comments for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingComments = await database
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.pullRequestId, pullRequestId),
          isNull(comments.deletedAt)
        )
      )

    const syncedGitHubIds: string[] = []

    for (const commentData of allComments) {
      syncedGitHubIds.push(commentData.id)

      const existingComment = existingComments.find(
        (c) => c.gitHubId === commentData.id
      )

      const commentId = existingComment?.id ?? generateId()

      const lineType = getLineTypeFromDiffHunk(commentData.diffHunk ?? '')
      let line: number | null = null
      let originalLine: number | null = null

      if (lineType === 'remove') {
        originalLine = commentData.originalLine ?? null
      } else if (lineType === 'add') {
        line = commentData.line ?? null
      } else {
        line = commentData.line ?? null
        originalLine = commentData.originalLine ?? null
      }

      const comment: NewComment = {
        id: commentId,
        gitHubId: commentData.id,
        pullRequestId,
        reviewId: null,
        body: commentData.body ? normalizeCommentBody(commentData.body) : null,
        bodyHtml: commentData.bodyHTML ?? null,
        path: commentData.path ?? null,
        line,
        originalLine,
        diffHunk: commentData.diffHunk ?? null,
        commitId: commentData.commit?.oid ?? null,
        originalCommitId: commentData.originalCommit?.oid ?? null,
        gitHubReviewId: commentData.pullRequestReview?.id ?? null,
        gitHubReviewThreadId: commentData.reviewThreadId ?? null,
        parentCommentGitHubId: commentData.replyTo?.id ?? null,
        userLogin: commentData.author?.login ?? null,
        userAvatarUrl: commentData.author?.avatarUrl ?? null,
        url: commentData.url ?? null,
        gitHubCreatedAt: commentData.createdAt ?? null,
        gitHubUpdatedAt: commentData.updatedAt ?? null,
        syncedAt: now,
        deletedAt: null
      }

      await database
        .insert(comments)
        .values(comment)
        .onConflictDoUpdate({
          target: comments.id,
          set: {
            body: comment.body,
            bodyHtml: comment.bodyHtml,
            path: comment.path,
            line: comment.line,
            originalLine: comment.originalLine,
            diffHunk: comment.diffHunk,
            commitId: comment.commitId,
            originalCommitId: comment.originalCommitId,
            gitHubReviewId: comment.gitHubReviewId,
            gitHubReviewThreadId: comment.gitHubReviewThreadId,
            parentCommentGitHubId: comment.parentCommentGitHubId,
            userLogin: comment.userLogin,
            userAvatarUrl: comment.userAvatarUrl,
            url: comment.url,
            gitHubCreatedAt: comment.gitHubCreatedAt,
            gitHubUpdatedAt: comment.gitHubUpdatedAt,
            syncedAt: comment.syncedAt,
            deletedAt: null
          }
        })

      const reactions =
        commentData.reactions?.nodes?.filter((r) => r !== null) ?? []

      for (const reactionData of reactions) {
        if (!reactionData?.user) {
          continue
        }

        const existingReaction = await database
          .select()
          .from(commentReactions)
          .where(eq(commentReactions.gitHubId, reactionData.id))
          .limit(1)

        const reaction: NewCommentReaction = {
          id: existingReaction[0]?.id ?? generateId(),
          gitHubId: reactionData.id,
          commentId,
          pullRequestId,
          content: reactionData.content,
          userLogin: reactionData.user.login,
          userId: reactionData.user.id,
          syncedAt: now,
          deletedAt: null
        }

        await database
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
      }
    }

    for (const existingComment of existingComments) {
      if (!syncedGitHubIds.includes(existingComment.gitHubId)) {
        await database
          .update(comments)
          .set({ deletedAt: now })
          .where(eq(comments.id, existingComment.id))
      }
    }

    console.timeEnd('syncComments')
  } catch (error) {
    console.timeEnd('syncComments')
    console.error('Error syncing pull request comments:', error)
    throw error
  }
}
