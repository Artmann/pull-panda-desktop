import { Loader2, Send, X } from 'lucide-react'
import { memo, useState, type ReactElement } from 'react'

import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { createComment } from '@/app/lib/api'
import { useAuth } from '@/app/lib/store/authContext'
import { getDraftKeyForComment } from '@/app/store/draftsSlice'
import { useAppDispatch } from '@/app/store/hooks'
import {
  createOptimisticComment,
  pullRequestDetailsActions
} from '@/app/store/pullRequestDetailsSlice'
import { useDraft } from '@/app/store/useDraft'

interface CommentInputProps {
  owner: string
  pullNumber: number
  pullRequestId: string
  repo: string
  reviewCommentId?: number
  onCancel?: () => void
  onSuccess?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export const CommentInput = memo(function CommentInput({
  owner,
  pullNumber,
  pullRequestId,
  repo,
  reviewCommentId,
  onCancel,
  onSuccess,
  placeholder = 'Write a comment...',
  autoFocus = false
}: CommentInputProps): ReactElement {
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

    // Create optimistic comment and add to store immediately
    const optimisticComment = createOptimisticComment({
      body: trimmedBody,
      pullRequestId,
      userLogin: user.login,
      userAvatarUrl: user.avatar_url
    })

    dispatch(
      pullRequestDetailsActions.addComment({
        pullRequestId,
        comment: optimisticComment
      })
    )

    // Clear draft immediately for better UX
    clearDraft()
    setIsSubmitting(true)
    setError(null)

    try {
      await createComment({
        body: trimmedBody,
        owner,
        pullNumber,
        repo,
        reviewCommentId
      })

      // Trigger sync to get the real comment from the server
      window.electron.syncPullRequestDetails(
        pullRequestId,
        owner,
        repo,
        pullNumber
      )
      onSuccess?.()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to post comment'
      )

      // Rollback optimistic comment on error
      dispatch(
        pullRequestDetailsActions.removeComment({
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

    if (event.key === 'Escape' && onCancel) {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoFocus={autoFocus}
        className="min-h-20 text-sm"
        disabled={isSubmitting}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={body}
      />

      {error && <div className="text-destructive text-xs">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            disabled={isSubmitting}
            onClick={onCancel}
            size="sm"
            variant="ghost"
          >
            <X className="size-3" />
            Cancel
          </Button>
        )}

        <Button
          disabled={!body.trim() || isSubmitting}
          onClick={handleSubmit}
          size="sm"
        >
          {isSubmitting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Send className="size-3" />
          )}
          {isSubmitting ? 'Posting...' : 'Comment'}
        </Button>
      </div>

      <div className="text-muted-foreground text-xs">
        Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to
        submit
      </div>
    </div>
  )
})

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
      pullRequestDetailsActions.addComment({
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

      window.electron.syncPullRequestDetails(
        pullRequestId,
        owner,
        repo,
        pullNumber
      )
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to post comment'
      )

      dispatch(
        pullRequestDetailsActions.removeComment({
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
