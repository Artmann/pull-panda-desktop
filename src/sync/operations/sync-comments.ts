import { Effect, Option } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import {
  commentReactions,
  comments,
  type NewComment,
  type NewCommentReaction
} from '../../database/schema'
import {
  SyncDetailFailedError,
  type SyncError
} from '../errors'
import {
  IssueCommentsResponseSchema,
  ReactionsResponseSchema,
  type IssueComment,
  type Reaction
} from '../schemas/github-rest'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { generateId, normalizeCommentBody } from '../shared/utils'

export interface SyncCommentsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const fetchReactions = (
  params: SyncCommentsParams,
  commentNumericId: number
) =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest

    const result = yield* rest
      .request(
        'GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions',
        {
          owner: params.owner,
          repo: params.repositoryName,
          comment_id: commentNumericId
        },
        ReactionsResponseSchema
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new SyncDetailFailedError({
              operation: 'issue_comment_reactions',
              pullRequestId: params.pullRequestId,
              cause
            }) as SyncError
        )
      )

    if (Option.isNone(result)) {
      return [] as ReadonlyArray<Reaction>
    }

    return result.value as ReadonlyArray<Reaction>
  })

export const syncComments = (
  params: SyncCommentsParams
): Effect.Effect<void, SyncError, Database | GitHubRest> =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest
    const database = yield* Database

    const result = yield* rest
      .request(
        'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
        {
          owner: params.owner,
          repo: params.repositoryName,
          issue_number: params.pullNumber,
          per_page: 100
        },
        IssueCommentsResponseSchema,
        {
          etagKey: {
            endpointType: 'issue_comments',
            resourceId: params.pullRequestId
          }
        }
      )
      .pipe(
        Effect.mapError(
          (cause) =>
            new SyncDetailFailedError({
              operation: 'issue_comments',
              pullRequestId: params.pullRequestId,
              cause
            }) as SyncError
        )
      )

    if (Option.isNone(result)) {
      return
    }

    const commentsData = result.value as ReadonlyArray<IssueComment>
    const now = new Date().toISOString()

    const commentEntries: Array<{ id: string; comment: IssueComment }> = []

    yield* database.use('syncComments.upsert', (db) => {
      const existingComments = db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.pullRequestId, params.pullRequestId),
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
          (row) => row.gitHubId === gitHubId
        )

        const commentId = existingComment?.id ?? generateId()

        commentEntries.push({ id: commentId, comment: commentData })

        const comment: NewComment = {
          id: commentId,
          gitHubId,
          gitHubNumericId: commentData.id,
          pullRequestId: params.pullRequestId,
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

        db.insert(comments)
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
      }

      for (const existingComment of existingComments) {
        if (!syncedGitHubIds.includes(existingComment.gitHubId)) {
          db.update(comments)
            .set({ deletedAt: now })
            .where(eq(comments.id, existingComment.id))
            .run()
        }
      }
    })

    for (const entry of commentEntries) {
      if (!entry.comment.reactions || entry.comment.reactions.total_count === 0) {
        continue
      }

      const reactionsData = yield* fetchReactions(params, entry.comment.id)

      yield* database.use('syncComments.reactions', (db) => {
        for (const reactionData of reactionsData) {
          if (!reactionData.user) {
            continue
          }

          const existingReaction = db
            .select()
            .from(commentReactions)
            .where(eq(commentReactions.gitHubId, reactionData.node_id))
            .get()

          const reaction: NewCommentReaction = {
            id: existingReaction?.id ?? generateId(),
            gitHubId: reactionData.node_id,
            commentId: entry.id,
            pullRequestId: params.pullRequestId,
            content: reactionData.content,
            userLogin: reactionData.user.login,
            userId: String(reactionData.user.id),
            syncedAt: now,
            deletedAt: null
          }

          db.insert(commentReactions)
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
      })
    }
  })
