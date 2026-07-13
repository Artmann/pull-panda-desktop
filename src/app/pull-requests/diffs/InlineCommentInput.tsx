import { memo, useState, type ReactElement } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { useAuth } from '@/app/lib/store/authContext'
import { startPendingReview } from '@/app/pull-requests/start-pending-review'
import { getDraftKeyForInlineComment } from '@/app/store/drafts-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pendingReviewCommentsActions } from '@/app/store/pending-review-comments-slice'
import { useDraft } from '@/app/store/use-draft'
import type { PullRequest } from '@/types/pull-request'

import type { GitHubSide } from './position'

interface InlineCommentInputProps {
  filePath: string
  line: number
  onCancel: () => void
  pullRequest: PullRequest
  side: GitHubSide
}

export const InlineCommentInput = memo(function InlineCommentInput({
  filePath,
  line,
  onCancel,
  pullRequest,
  side
}: InlineCommentInputProps): ReactElement | null {
  const dispatch = useAppDispatch()
  const { user } = useAuth()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )

  const draftKey = getDraftKeyForInlineComment(
    pullRequest.id,
    filePath,
    line,
    side
  )

  // Use draft for persistence, but local state for fast typing
  const {
    body: draftBody,
    setBody: setDraftBody,
    clearDraft
  } = useDraft(draftKey)
  const [localBody, setLocalBody] = useState(draftBody)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const syncDraft = () => {
    // Sync to draft store for persistence
    if (localBody !== draftBody) {
      setDraftBody(localBody)
    }
  }

  const handleCancel = () => {
    syncDraft()
    onCancel()
  }

  const ensurePendingReview = async () => {
    if (pendingReview) {
      return true
    }

    return startPendingReview({ dispatch, pullRequest })
  }

  const handleSubmit = async () => {
    const trimmedBody = localBody.trim()

    if (!trimmedBody) {
      return
    }

    setIsSubmitting(true)

    const reviewStarted = await ensurePendingReview()

    if (!reviewStarted) {
      setIsSubmitting(false)

      return
    }

    const commentId = `temp-${crypto.randomUUID()}`

    dispatch(
      pendingReviewCommentsActions.addComment({
        pullRequestId: pullRequest.id,
        comment: {
          body: trimmedBody,
          id: commentId,
          line,
          path: filePath,
          side
        }
      })
    )

    clearDraft()
    setIsSubmitting(false)
    onCancel()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      handleSubmit()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancel()
    }
  }

  return (
    <div className="border-l-3 border-l-status-warning-foreground bg-status-warning p-3 font-sans font-normal">
      <div className="flex gap-3">
        {user && (
          <Avatar className="size-6 shrink-0">
            <AvatarImage
              alt={user.login}
              src={user.avatar_url}
            />
            <AvatarFallback>{user.login[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 flex flex-col gap-2">
          <Textarea
            autoFocus
            className="min-h-16 text-sm bg-background"
            disabled={isSubmitting}
            placeholder="Add a comment..."
            value={localBody}
            onBlur={syncDraft}
            onChange={(event) => setLocalBody(event.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to
              add
            </div>

            <div className="flex items-center gap-2">
              <Button
                disabled={isSubmitting}
                size="sm"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>

              <Button
                disabled={!localBody.trim() || isSubmitting}
                onClick={handleSubmit}
                size="sm"
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
