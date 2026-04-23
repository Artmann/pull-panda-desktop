import { memo, useState, type ReactElement } from 'react'

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
    <div className="w-full flex flex-col gap-2 py-2">
      <Textarea
        className="h-16 text-sm resize-none border-muted"
        disabled={isSubmitting}
        placeholder="Say something"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {error && <div className="text-destructive text-xs">{error}</div>}

      <div className="flex justify-end">
        <Button
          disabled={!body.trim() || isSubmitting}
          size="sm"
          onClick={handleSubmit}
        >
          Post
        </Button>
      </div>
    </div>
  )
})
