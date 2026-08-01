import { and, eq, isNull, type Column, type SQL } from 'drizzle-orm'
import type { SQLJsDatabase } from 'drizzle-orm/sql-js'

import {
  checks,
  commentReactions,
  comments,
  commits,
  modifiedFiles,
  reviews,
  reviewThreads
} from './schema'

interface PullRequestScopedTable {
  deletedAt: Column
  pullRequestId: Column
}

function relatedTo(
  table: PullRequestScopedTable,
  pullRequestId: string
): SQL | undefined {
  return and(eq(table.pullRequestId, pullRequestId), isNull(table.deletedAt))
}

// Loads every live (not soft-deleted) row family related to one pull request.
// Shared by the bootstrap payload and the inspect-pr script so the two stay
// in sync about what "related data" means.
export function loadPullRequestRows(
  database: SQLJsDatabase<Record<string, unknown>>,
  pullRequestId: string
) {
  return {
    checkRows: database
      .select()
      .from(checks)
      .where(relatedTo(checks, pullRequestId))
      .all(),
    commentRows: database
      .select()
      .from(comments)
      .where(relatedTo(comments, pullRequestId))
      .all(),
    commitRows: database
      .select()
      .from(commits)
      .where(relatedTo(commits, pullRequestId))
      .all(),
    fileRows: database
      .select()
      .from(modifiedFiles)
      .where(relatedTo(modifiedFiles, pullRequestId))
      .all(),
    reactionRows: database
      .select()
      .from(commentReactions)
      .where(relatedTo(commentReactions, pullRequestId))
      .all(),
    reviewRows: database
      .select()
      .from(reviews)
      .where(relatedTo(reviews, pullRequestId))
      .all(),
    reviewThreadRows: database
      .select()
      .from(reviewThreads)
      .where(relatedTo(reviewThreads, pullRequestId))
      .all()
  }
}
