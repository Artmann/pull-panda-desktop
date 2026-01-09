import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const pullRequests = sqliteTable('pull_requests', {
  id: text('id').primaryKey(),

  number: integer('number').notNull(),
  title: text('title').notNull(),
  state: text('state').notNull(),
  url: text('url').notNull(),

  repositoryOwner: text('repository_owner').notNull(),
  repositoryName: text('repository_name').notNull(),

  authorLogin: text('author_login'),
  authorAvatarUrl: text('author_avatar_url'),

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  closedAt: text('closed_at'),
  mergedAt: text('merged_at'),

  body: text('body'),
  bodyHtml: text('body_html'),

  isDraft: integer('is_draft', { mode: 'boolean' }).notNull().default(false),
  isAuthor: integer('is_author', { mode: 'boolean' }).notNull().default(false),
  isAssignee: integer('is_assignee', { mode: 'boolean' })
    .notNull()
    .default(false),
  isReviewer: integer('is_reviewer', { mode: 'boolean' })
    .notNull()
    .default(false),

  labels: text('labels'),
  assignees: text('assignees'),

  syncedAt: text('synced_at').notNull(),
  detailsSyncedAt: text('details_synced_at')
})

export type PullRequest = typeof pullRequests.$inferSelect
export type NewPullRequest = typeof pullRequests.$inferInsert

export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    gitHubId: text('github_id').notNull(),
    pullRequestId: text('pull_request_id').notNull(),

    state: text('state').notNull(),
    body: text('body'),
    bodyHtml: text('body_html'),
    url: text('url'),

    authorLogin: text('author_login'),
    authorAvatarUrl: text('author_avatar_url'),

    gitHubCreatedAt: text('github_created_at'),
    gitHubSubmittedAt: text('github_submitted_at'),

    syncedAt: text('synced_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (table) => [index('reviews_pull_request_id_idx').on(table.pullRequestId)]
)

export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    gitHubId: text('github_id').notNull(),
    gitHubNumericId: integer('github_numeric_id'),
    pullRequestId: text('pull_request_id').notNull(),
    reviewId: text('review_id'),

    body: text('body'),
    bodyHtml: text('body_html'),
    path: text('path'),
    line: integer('line'),
    originalLine: integer('original_line'),
    diffHunk: text('diff_hunk'),
    commitId: text('commit_id'),
    originalCommitId: text('original_commit_id'),

    gitHubReviewId: text('github_review_id'),
    gitHubReviewThreadId: text('github_review_thread_id'),
    parentCommentGitHubId: text('parent_comment_github_id'),

    userLogin: text('user_login'),
    userAvatarUrl: text('user_avatar_url'),

    url: text('url'),
    gitHubCreatedAt: text('github_created_at'),
    gitHubUpdatedAt: text('github_updated_at'),

    syncedAt: text('synced_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (table) => [index('comments_pull_request_id_idx').on(table.pullRequestId)]
)

export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert

export const commentReactions = sqliteTable(
  'comment_reactions',
  {
    id: text('id').primaryKey(),
    gitHubId: text('github_id').notNull(),
    commentId: text('comment_id').notNull(),
    pullRequestId: text('pull_request_id').notNull(),

    content: text('content').notNull(),
    userLogin: text('user_login'),
    userId: text('user_id'),

    syncedAt: text('synced_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (table) => [index('comment_reactions_comment_id_idx').on(table.commentId)]
)

export type CommentReaction = typeof commentReactions.$inferSelect
export type NewCommentReaction = typeof commentReactions.$inferInsert

export const checks = sqliteTable(
  'checks',
  {
    id: text('id').primaryKey(),
    gitHubId: text('github_id').notNull(),
    pullRequestId: text('pull_request_id').notNull(),

    name: text('name').notNull(),
    state: text('state'),
    conclusion: text('conclusion'),
    commitSha: text('commit_sha'),
    suiteName: text('suite_name'),
    durationInSeconds: integer('duration_in_seconds'),

    detailsUrl: text('details_url'),
    message: text('message'),
    url: text('url'),

    gitHubCreatedAt: text('github_created_at'),
    gitHubUpdatedAt: text('github_updated_at'),

    syncedAt: text('synced_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (table) => [index('checks_pull_request_id_idx').on(table.pullRequestId)]
)

export type Check = typeof checks.$inferSelect
export type NewCheck = typeof checks.$inferInsert

export const commits = sqliteTable(
  'commits',
  {
    id: text('id').primaryKey(),
    gitHubId: text('github_id').notNull(),
    pullRequestId: text('pull_request_id').notNull(),

    hash: text('hash').notNull(),
    message: text('message'),
    url: text('url'),

    authorLogin: text('author_login'),
    authorAvatarUrl: text('author_avatar_url'),

    linesAdded: integer('lines_added'),
    linesRemoved: integer('lines_removed'),

    gitHubCreatedAt: text('github_created_at'),

    syncedAt: text('synced_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (table) => [index('commits_pull_request_id_idx').on(table.pullRequestId)]
)

export type Commit = typeof commits.$inferSelect
export type NewCommit = typeof commits.$inferInsert

export const modifiedFiles = sqliteTable(
  'modified_files',
  {
    id: text('id').primaryKey(),
    pullRequestId: text('pull_request_id').notNull(),

    filename: text('filename').notNull(),
    filePath: text('file_path').notNull(),
    status: text('status'),

    additions: integer('additions'),
    deletions: integer('deletions'),
    changes: integer('changes'),

    diffHunk: text('diff_hunk'),

    syncedAt: text('synced_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (table) => [
    index('modified_files_pull_request_id_idx').on(table.pullRequestId)
  ]
)

export type ModifiedFile = typeof modifiedFiles.$inferSelect
export type NewModifiedFile = typeof modifiedFiles.$inferInsert

export const etags = sqliteTable(
  'etags',
  {
    id: text('id').primaryKey(),
    endpointType: text('endpoint_type').notNull(),
    resourceId: text('resource_id').notNull(),
    etag: text('etag').notNull(),
    lastModified: text('last_modified'),
    validatedAt: text('validated_at').notNull()
  },
  (table) => [
    index('etags_endpoint_resource_idx').on(
      table.endpointType,
      table.resourceId
    )
  ]
)

export type ETag = typeof etags.$inferSelect
export type NewETag = typeof etags.$inferInsert
