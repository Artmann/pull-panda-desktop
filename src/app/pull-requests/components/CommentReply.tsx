import { Loader2 } from 'lucide-react'
import {
  memo,
  useCallback,
  useState,
  type FormEvent,
  type ReactElement
} from 'react'

import type { PullRequest } from '@/types/pull-request'
import type { Comment } from '@/types/pull-request-details'

import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { createComment, syncPullRequestDetails } from '@/app/lib/api'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import { useAuth } from '@/app/lib/store/authContext'
import {
  commentsActions,
  createOptimisticComment
} from '@/app/store/comments-slice'
import { getDraftKeyForReply } from '@/app/store/drafts-slice'
import { useAppDispatch } from '@/app/store/hooks'
import { useDraft } from '@/app/store/use-draft'

interface CommentReplyProps {
  comment: Comment
  pullRequest: PullRequest
}

export const CommentReply = memo(function CommentReply({
  comment,
  pullRequest
}: CommentReplyProps): ReactElement {
  const draftKey = getDraftKeyForReply(pullRequest.id, comment.gitHubId)
  const { body, setBody, clearDraft } = useDraft(draftKey)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dispatch = useAppDispatch()
  const { user } = useAuth()

  const isReviewComment = comment.gitHubReviewThreadId !== null
  const reviewCommentId = isReviewComment
    ? (comment.gitHubNumericId ?? undefined)
    : undefined

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()

      if (!body.trim() || isSubmitting || !user) {
        return
      }

      const trimmedBody = body.trim()

      const optimisticComment = createOptimisticComment({
        body: trimmedBody,
        pullRequestId: pullRequest.id,
        userLogin: user.login,
        userAvatarUrl: user.avatar_url,
        parentCommentGitHubId: comment.gitHubId,
        gitHubReviewThreadId: comment.gitHubReviewThreadId ?? undefined
      })

      setIsSubmitting(true)

      runOptimisticMutation({
        optimistic: () => {
          dispatch(
            commentsActions.addComment({
              pullRequestId: pullRequest.id,
              comment: optimisticComment
            })
          )

          clearDraft()
        },
        request: () =>
          createComment({
            body: trimmedBody,
            owner: pullRequest.repositoryOwner,
            pullNumber: pullRequest.number,
            repo: pullRequest.repositoryName,
            reviewCommentId
          }),
        commit: () => {
          void syncPullRequestDetails(pullRequest.id)
        },
        rollback: () =>
          dispatch(
            commentsActions.removeComment({
              pullRequestId: pullRequest.id,
              commentId: optimisticComment.id
            })
          ),
        settled: () => setIsSubmitting(false),
        errorMessage: 'Failed to post comment'
      })
    },
    [
      body,
      clearDraft,
      comment.gitHubId,
      comment.gitHubReviewThreadId,
      dispatch,
      isSubmitting,
      pullRequest.id,
      pullRequest.number,
      pullRequest.repositoryName,
      pullRequest.repositoryOwner,
      reviewCommentId,
      user
    ]
  )

  return (
    <form
      className="flex items-end gap-2 w-full"
      onSubmit={handleSubmit}
    >
      <Textarea
        className="flex-1 border-0 focus:ring-0 focus:border-0 shadow-none resize-none min-h-2 box-border text-xs md:text-xs placeholder:text-xs"
        disabled={isSubmitting}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Reply to comment..."
        value={body}
      />

      <Button
        disabled={!body.trim() || isSubmitting}
        size="sm"
        type="submit"
        variant="ghost"
      >
        {isSubmitting && <Loader2 className="size-3 animate-spin" />}
        {isSubmitting ? 'Posting...' : 'Post'}
      </Button>
    </form>
  )
})
