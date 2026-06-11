import { Effect, Option } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import {
  commentReactions,
  comments,
  type NewComment,
  type NewCommentReaction
} from '../../database/schema'
import { SyncDetailFailedError, type SyncError } from '../errors'
import {
  IssueCommentsResponseSchema,
  ReactionsResponseSchema,
  type IssueComment,
  type Reaction
} from '../schemas/github-rest'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { paginateRest } from '../shared/paginate'
import { generateId, normalizeCommentBody } from '../shared/utils'

export interface SyncCommentsParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const buildIssueComment = (
  commentData: IssueComment,
  commentId: string,
  pullRequestId: string,
  now: string
): NewComment => ({
  id: commentId,
  gitHubId: commentData.node_id,
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
})

const fetchReactions = (params: SyncCommentsParams, commentNumericId: number) =>
  paginateRest(
    'GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions',
    {
      owner: params.owner,
      repo: params.repositoryName,
      comment_id: commentNumericId
    },
    ReactionsResponseSchema
  ).pipe(
    Effect.mapError(
      (cause) =>
        new SyncDetailFailedError({
          operation: 'issue_comment_reactions',
          pullRequestId: params.pullRequestId,
          cause
        }) as SyncError
    ),
    Effect.map((result) =>
      Option.isNone(result) ? [] : (result.value as ReadonlyArray<Reaction>)
    )
  )

export const syncComments = (
  params: SyncCommentsParams
): Effect.Effect<void, SyncError, Database | GitHubRest> =>
  Effect.gen(function* () {
    const database = yield* Database

    const result = yield* paginateRest(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner: params.owner,
        repo: params.repositoryName,
        issue_number: params.pullNumber
      },
      IssueCommentsResponseSchema,
      {
        etagKey: {
          endpointType: 'issue_comments',
          resourceId: params.pullRequestId
        }
      }
    ).pipe(
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

        const comment = buildIssueComment(
          commentData,
          commentId,
          params.pullRequestId,
          now
        )

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
      // Always reconcile reactions against the server, even when total_count is
      // zero — otherwise removed reactions stay around locally forever.
      const reactionsData =
        entry.comment.reactions && entry.comment.reactions.total_count > 0
          ? yield* fetchReactions(params, entry.comment.id)
          : ([] as ReadonlyArray<Reaction>)

      yield* database.use('syncComments.reactions', (db) => {
        const existingReactions = db
          .select()
          .from(commentReactions)
          .where(
            and(
              eq(commentReactions.commentId, entry.id),
              isNull(commentReactions.deletedAt)
            )
          )
          .all()

        const syncedGitHubIds: string[] = []

        for (const reactionData of reactionsData) {
          if (!reactionData.user) {
            continue
          }

          syncedGitHubIds.push(reactionData.node_id)

          const existingReaction = existingReactions.find(
            (row) => row.gitHubId === reactionData.node_id
          )

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

        for (const existingReaction of existingReactions) {
          if (!syncedGitHubIds.includes(existingReaction.gitHubId)) {
            db.update(commentReactions)
              .set({ deletedAt: now })
              .where(eq(commentReactions.id, existingReaction.id))
              .run()
          }
        }
      })
    }
  })
