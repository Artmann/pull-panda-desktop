import { commentMarker } from './format'
import type { ReviewThread, RobotThread } from './types'

export function findRobotThreads(
  threads: ReviewThread[]
): Map<string, RobotThread> {
  const robotThreads = new Map<string, RobotThread>()

  for (const thread of threads) {
    const firstComment = thread.comments.nodes[0]

    if (!firstComment || !firstComment.body.includes(commentMarker)) {
      continue
    }

    if (thread.isResolved) {
      continue
    }

    const slugMatch = firstComment.body.match(/<!-- robot-issue: (.+?) -->/)

    if (slugMatch) {
      robotThreads.set(slugMatch[1], {
        commentId: firstComment.databaseId,
        threadId: thread.id,
      })
    }
  }

  return robotThreads
}
