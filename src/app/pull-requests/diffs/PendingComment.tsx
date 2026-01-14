import { Pencil, Trash2 } from 'lucide-react'
import { memo, useState, type ReactElement } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { useAuth } from '@/app/lib/store/authContext'
import { useAppDispatch } from '@/app/store/hooks'
import {
  pendingReviewCommentsActions,
  type PendingReviewComment
} from '@/app/store/pending-review-comments-slice'

interface PendingCommentProps {
  comment: PendingReviewComment
  pullRequestId: string
}

export const PendingComment = memo(function PendingComment({
  comment,
  pullRequestId
}: PendingCommentProps): ReactElement {
  const dispatch = useAppDispatch()
  const { user } = useAuth()

  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)

  const handleDelete = () => {
    dispatch(
      pendingReviewCommentsActions.removeComment({
        pullRequestId,
        commentId: comment.id
      })
    )
  }

  const handleSaveEdit = () => {
    const trimmedBody = editBody.trim()

    if (!trimmedBody) {
      return
    }

    dispatch(
      pendingReviewCommentsActions.updateComment({
        pullRequestId,
        commentId: comment.id,
        body: trimmedBody
      })
    )

    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditBody(comment.body)
    setIsEditing(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      handleSaveEdit()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelEdit()
    }
  }

  return (
    <div className="border-l-3 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 font-normal font-sans">
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {user && (
                <span className="font-medium text-sm">{user.login}</span>
              )}
              <Badge
                className="text-xs"
                variant="outline"
              >
                Pending
              </Badge>
            </div>

            {!isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setIsEditing(true)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Pencil className="size-3" />
                </Button>

                <Button
                  onClick={handleDelete}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                autoFocus
                className="min-h-16 text-sm bg-background resize-none"
                onChange={(event) => setEditBody(event.target.value)}
                onKeyDown={handleKeyDown}
                value={editBody}
              />

              <div className="flex items-center justify-end gap-2">
                <Button
                  onClick={handleCancelEdit}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>

                <Button
                  disabled={!editBody.trim()}
                  onClick={handleSaveEdit}
                  size="sm"
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <MarkdownBlock
              className="text-sm prose-p:my-0 prose-pre:my-1"
              content={comment.body}
              path={comment.path}
            />
          )}
        </div>
      </div>
    </div>
  )
})
