import { Effect } from 'effect'
import { eq } from 'drizzle-orm'

import {
  checks,
  commentReactions,
  comments,
  commits,
  etags,
  modifiedFiles,
  pullRequests,
  reviewThreads,
  reviews
} from '../../database/schema'
import { Database } from '../services/database'

export const deletePullRequestData = (pullRequestId: string) =>
  Effect.gen(function* () {
    const database = yield* Database

    yield* database.use('deletePullRequestData', (db) => {
      db.delete(commentReactions)
        .where(eq(commentReactions.pullRequestId, pullRequestId))
        .run()
      db.delete(comments).where(eq(comments.pullRequestId, pullRequestId)).run()
      db.delete(reviewThreads)
        .where(eq(reviewThreads.pullRequestId, pullRequestId))
        .run()
      db.delete(reviews).where(eq(reviews.pullRequestId, pullRequestId)).run()
      db.delete(checks).where(eq(checks.pullRequestId, pullRequestId)).run()
      db.delete(commits).where(eq(commits.pullRequestId, pullRequestId)).run()
      db.delete(modifiedFiles)
        .where(eq(modifiedFiles.pullRequestId, pullRequestId))
        .run()
      db.delete(etags).where(eq(etags.resourceId, pullRequestId)).run()
      db.delete(pullRequests).where(eq(pullRequests.id, pullRequestId)).run()
    })

    yield* Effect.logInfo(
      `Deleted inaccessible PR ${pullRequestId} and all related data`
    )
  })
