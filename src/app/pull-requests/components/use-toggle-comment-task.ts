import type { ToggleTaskHandler } from '@/app/components/MarkdownInput'
import { updateComment } from '@/app/lib/api'
import { runSerialMutation } from '@/app/lib/mutations/run-serial-mutation'
import { useAuth } from '@/app/lib/store/authContext'
import { toggleTaskListItem } from '@/app/lib/task-list'
import { commentsActions } from '@/app/store/comments-slice'
import { useAppDispatch } from '@/app/store/hooks'
import { pendingEditKeys } from '@/app/store/pending-edits'
import type { Comment } from '@/types/pull-request-details'

/**
 * Returns a handler that ticks a task list checkbox in the comment and saves
 * the new body to GitHub, or `undefined` when the checkboxes should stay
 * read-only. Only the viewer's own comments are editable here: we don't know
 * whether the viewer has the repository access GitHub needs to edit anyone
 * else's, and a click that always fails is worse than one that isn't offered.
 */
export function useToggleCommentTask(
  comment: Comment
): ToggleTaskHandler | undefined {
  const dispatch = useAppDispatch()
  const { user } = useAuth()

  const isSaved =
    comment.gitHubNumericId !== null && !comment.id.startsWith('temp-')
  const isOwnComment =
    user?.login !== undefined && user.login === comment.userLogin

  if (!isSaved || !isOwnComment) {
    return
  }

  return (taskIndex: number) => {
    const nextBody = toggleTaskListItem(comment.body ?? '', taskIndex)

    if (nextBody === null) {
      return
    }

    runSerialMutation({
      commit: (updated) => dispatch(commentsActions.updateComment(updated)),
      errorMessage: 'Could not update the task list in the comment.',
      key: pendingEditKeys.commentBody(comment.id),
      optimistic: () =>
        dispatch(commentsActions.updateComment({ ...comment, body: nextBody })),
      request: () => updateComment({ body: nextBody, commentId: comment.id }),
      rollback: () => dispatch(commentsActions.updateComment(comment))
    })
  }
}
