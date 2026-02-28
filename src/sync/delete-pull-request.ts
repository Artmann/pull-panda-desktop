import { eq } from 'drizzle-orm'
import { log } from 'tiny-typescript-logger'

import { getDatabase } from '../database'
import {
  checks,
  commentReactions,
  comments,
  commits,
  etags,
  modifiedFiles,
  pullRequests,
  reviews
} from '../database/schema'

/**
 * Delete a pull request and all its related data from the database. Used when a
 * PR's repository becomes inaccessible (e.g., the user lost access).
 */
export function deletePullRequestData(pullRequestId: string): void {
  const database = getDatabase()

  database
    .delete(commentReactions)
    .where(eq(commentReactions.pullRequestId, pullRequestId))
    .run()

  database
    .delete(comments)
    .where(eq(comments.pullRequestId, pullRequestId))
    .run()

  database
    .delete(reviews)
    .where(eq(reviews.pullRequestId, pullRequestId))
    .run()

  database
    .delete(checks)
    .where(eq(checks.pullRequestId, pullRequestId))
    .run()

  database
    .delete(commits)
    .where(eq(commits.pullRequestId, pullRequestId))
    .run()

  database
    .delete(modifiedFiles)
    .where(eq(modifiedFiles.pullRequestId, pullRequestId))
    .run()

  database
    .delete(etags)
    .where(eq(etags.resourceId, pullRequestId))
    .run()

  database
    .delete(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .run()

  log.info(`Deleted inaccessible PR ${pullRequestId} and all related data`)
}
