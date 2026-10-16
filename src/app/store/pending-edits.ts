import { isSerialMutationPending } from '@/app/lib/mutations/run-serial-mutation'
import type { ResourceUpdatedEvent } from '@/types/ipc-events'
import type { PullRequest } from '@/types/pull-request'
import type { Comment } from '@/types/pull-request-details'

import type { RootState } from '.'

export const pendingEditKeys = {
  commentBody: (commentId: string) => `comment-body:${commentId}`,
  pullRequestBody: (pullRequestId: string) =>
    `pull-request-body:${pullRequestId}`
}

/**
 * Keeps bodies the user is still saving out of an update pushed from the main
 * process. The database only has the edits GitHub has confirmed, so a sync
 * that broadcasts mid-save would show an older body for a moment and then
 * flick back once the save lands.
 */
export function keepPendingEdits(
  event: ResourceUpdatedEvent,
  state: RootState
): ResourceUpdatedEvent {
  switch (event.type) {
    case 'comments':
      return {
        ...event,
        data: event.data.map((comment) =>
          keepPendingCommentBody(comment, state)
        )
      }

    case 'pull-request':
      return { ...event, data: keepPendingPullRequestBody(event.data, state) }

    case 'pull-requests':
      return {
        ...event,
        data: event.data.map((pullRequest) =>
          keepPendingPullRequestBody(pullRequest, state)
        )
      }

    default:
      return event
  }
}

function keepPendingCommentBody(comment: Comment, state: RootState): Comment {
  if (!isSerialMutationPending(pendingEditKeys.commentBody(comment.id))) {
    return comment
  }

  const local = state.comments.items.find((item) => item.id === comment.id)

  return local ? { ...comment, body: local.body } : comment
}

function keepPendingPullRequestBody(
  pullRequest: PullRequest,
  state: RootState
): PullRequest {
  if (
    !isSerialMutationPending(pendingEditKeys.pullRequestBody(pullRequest.id))
  ) {
    return pullRequest
  }

  const local = state.pullRequests.items.find(
    (item) => item.id === pullRequest.id
  )

  return local ? { ...pullRequest, body: local.body } : pullRequest
}
