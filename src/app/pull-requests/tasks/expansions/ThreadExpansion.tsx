import { useMemo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { PullRequest } from '@/types/pull-request'

import {
  CommentThreadCard,
  FileCommentThreadCard
} from '@/app/pull-requests/components/CommentThread'
import { useAppSelector } from '@/app/store/hooks'

import type { ThreadTask } from '../task-types'

interface ThreadExpansionProps {
  pullRequest: PullRequest
  task: ThreadTask
}

export function ThreadExpansion({
  pullRequest,
  task
}: ThreadExpansionProps): ReactElement {
  const allComments = useAppSelector((state) => {
    if (!task.thread) {
      return [task.anchorComment]
    }

    return state.comments.items.filter(
      (comment) =>
        comment.gitHubReviewThreadId === task.thread?.gitHubId ||
        comment.id === task.anchorComment.id
    )
  }, shallowEqual)

  const sortedComments = useMemo(() => {
    return [...allComments].sort((a, b) => {
      const aTime = a.gitHubCreatedAt ?? ''
      const bTime = b.gitHubCreatedAt ?? ''

      return aTime.localeCompare(bTime)
    })
  }, [allComments])

  if (task.anchorComment.diffHunk) {
    return (
      <FileCommentThreadCard
        allComments={sortedComments}
        comment={task.anchorComment}
        pullRequest={pullRequest}
        showPromptButton
      />
    )
  }

  return (
    <CommentThreadCard
      allComments={sortedComments}
      comment={task.anchorComment}
      pullRequest={pullRequest}
      showPromptButton
    />
  )
}
