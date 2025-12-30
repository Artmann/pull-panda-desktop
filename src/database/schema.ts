import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

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

  isAuthor: integer('is_author', { mode: 'boolean' }).notNull().default(false),
  isAssignee: integer('is_assignee', { mode: 'boolean' }).notNull().default(false),
  isReviewer: integer('is_reviewer', { mode: 'boolean' }).notNull().default(false),

  labels: text('labels'),
  assignees: text('assignees'),

  syncedAt: text('synced_at').notNull()
})

export type PullRequest = typeof pullRequests.$inferSelect
export type NewPullRequest = typeof pullRequests.$inferInsert
