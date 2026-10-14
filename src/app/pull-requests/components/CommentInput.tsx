import { memo, useState, type ReactElement } from 'react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { createComment, syncPullRequestDetails } from '@/app/lib/api'
import { useAuth } from '@/app/lib/store/authContext'
import {
  commentsActions,
  createOptimisticComment
} from '@/app/store/comments-slice'
import { getDraftKeyForComment } from '@/app/store/drafts-slice'
import { useAppDispatch } from '@/app/store/hooks'
import { useDraft } from '@/app/store/use-draft'

interface NewCommentFormProps {
  owner: string
  pullNumber: number
  pullRequestId: string
  repo: string
}

export const NewCommentForm = memo(function NewCommentForm({
  owner,
  pullNumber,
  pullRequestId,
  repo
}: NewCommentFormProps): ReactElement {
  const draftKey = getDraftKeyForComment(pullRequestId)
  const { body, setBody, clearDraft } = useDraft(draftKey)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = useAppDispatch()
  const { user } = useAuth()

  const handleSubmit = async () => {
    if (!body.trim() || !user) {
      return
    }

    const trimmedBody = body.trim()

    const optimisticComment = createOptimisticComment({
      body: trimmedBody,
      pullRequestId,
      userLogin: user.login,
      userAvatarUrl: user.avatar_url
    })

    dispatch(
      commentsActions.addComment({
        pullRequestId,
        comment: optimisticComment
      })
    )

    clearDraft()
    setIsSubmitting(true)
    setError(null)

    try {
      await createComment({
        body: trimmedBody,
        owner,
        pullNumber,
        repo
      })

      syncPullRequestDetails(pullRequestId)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to post comment'
      )

      dispatch(
        commentsActions.removeComment({
          pullRequestId,
          commentId: optimisticComment.id
        })
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex w-full gap-3 pt-4">
      <Avatar className="mt-0.5 size-6.5 shrink-0">
        <AvatarImage
          alt={user?.login ?? 'You'}
          src={user?.avatar_url}
        />
        <AvatarFallback className="text-2xs uppercase">
          {(user?.login ?? 'You').slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col rounded-lg border border-border bg-card focus-within:border-ring">
          <Textarea
            aria-label="Comment"
            className="min-h-16 resize-none rounded-b-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={isSubmitting}
            placeholder="Leave a comment…"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="flex justify-end border-t border-border p-2">
            <Button
              disabled={!body.trim() || isSubmitting}
              size="sm"
              variant="secondary"
              onClick={handleSubmit}
            >
              Comment
            </Button>
          </div>
        </div>

        {error && <div className="text-destructive text-xs">{error}</div>}
      </div>
    </div>
  )
})
