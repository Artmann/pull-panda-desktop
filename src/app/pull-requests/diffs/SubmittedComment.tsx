import { memo, type ReactElement } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import { TimeAgo } from '@/app/components/TimeAgo'
import type { Comment } from '@/types/pull-request-details'

interface SubmittedCommentProps {
  comment: Comment
}

export const SubmittedComment = memo(function SubmittedComment({
  comment
}: SubmittedCommentProps): ReactElement {
  const authorLogin = comment.userLogin ?? 'Unknown'
  const authorAvatar = comment.userAvatarUrl ?? undefined

  return (
    <div className="border-l-3 border-l-blue-500 border-border border-y bg-background p-3 font-normal font-sans">
      <div className="flex gap-3">
        <Avatar className="size-6 shrink-0">
          <AvatarImage
            alt={authorLogin}
            src={authorAvatar}
          />
          <AvatarFallback>{authorLogin[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{authorLogin}</span>

            {comment.gitHubCreatedAt && (
              <TimeAgo dateTime={comment.gitHubCreatedAt} />
            )}
          </div>

          <MarkdownBlock
            className="text-sm prose-p:my-0 prose-pre:my-1"
            content={comment.body ?? ''}
            path={comment.path ?? undefined}
          />
        </div>
      </div>
    </div>
  )
})
