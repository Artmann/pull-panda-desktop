import { Code2 } from 'lucide-react'
import { Fragment, memo, type ReactElement } from 'react'

import type { Comment } from '@/types/pullRequestDetails'

import { TimeAgo } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'

import { CommentBody } from './CommentBody'
import { SimpleDiff } from '../diffs/SimpleDiff'

interface CommentThreadProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor?: boolean
}

export const CommentThread = memo(function CommentThread({
  comment,
  allComments,
  hideAuthor = false
}: CommentThreadProps): ReactElement {
  const childComments = allComments.filter(
    (c) => c.parentCommentGitHubId === comment.gitHubId
  )

  return (
    <>
      <CommentItem
        comment={comment}
        hideAuthor={hideAuthor}
      />

      {childComments.length > 0 && (
        <div className="border-t border-border">
          {childComments.map((childComment, index) => (
            <Fragment key={childComment.id}>
              {index > 0 && <Separator />}
              <CommentItem
                comment={childComment}
                hideAuthor={false}
              />
            </Fragment>
          ))}
        </div>
      )}
    </>
  )
})

interface CommentItemProps {
  comment: Comment
  hideAuthor?: boolean
}

const CommentItem = memo(function CommentItem({
  comment,
  hideAuthor = false
}: CommentItemProps): ReactElement {
  return (
    <div className="flex flex-col w-full p-4 gap-1.5">
      {!hideAuthor && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="size-5 text-xs">
              <AvatarImage
                alt={comment.userLogin ?? ''}
                src={comment.userAvatarUrl ?? undefined}
              />
              <AvatarFallback className="uppercase">
                {(comment.userLogin ?? '??').slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="flex gap-2 text-xs">
              <div className="font-medium">{comment.userLogin}</div>
              {comment.gitHubCreatedAt && (
                <TimeAgo dateTime={comment.gitHubCreatedAt} />
              )}
            </div>
          </div>
        </div>
      )}

      {comment.body && (
        <CommentBody
          content={comment.body}
          path={comment.path ?? undefined}
        />
      )}
    </div>
  )
})

interface CommentThreadCardProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor?: boolean
}

export const CommentThreadCard = memo(function CommentThreadCard({
  comment,
  allComments,
  hideAuthor = false
}: CommentThreadCardProps): ReactElement {
  return (
    <Card className="p-0 w-full gap-0 shadow-none">
      <CardContent className="p-0 w-full">
        <CommentThread
          comment={comment}
          allComments={allComments}
          hideAuthor={hideAuthor}
        />
      </CardContent>
    </Card>
  )
})

interface FileCommentThreadCardProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor?: boolean
}

export const FileCommentThreadCard = memo(function FileCommentThreadCard({
  comment,
  allComments,
  hideAuthor = false
}: FileCommentThreadCardProps): ReactElement {
  const numberOfLinesToShow = 3
  const line = comment.line ? comment.line : (comment.originalLine ?? 0)
  const lineStart = Math.max(0, line - numberOfLinesToShow)
  const lineEnd = Math.max(0, line)

  return (
    <Card className="p-0 w-full gap-0 shadow-none">
      <CardHeader className="px-4 py-3 pb-4! bg-muted/50 border-b border-border flex items-center gap-3">
        <Code2 className="w-4 h-4 text-muted-foreground" />
        <CardTitle className="text-xs text-muted-foreground font-mono">
          {comment.path}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 w-full">
        {comment.diffHunk && (
          <SimpleDiff
            diffHunk={comment.diffHunk}
            lineStart={lineStart}
            lineEnd={lineEnd}
          />
        )}
        <CommentThread
          comment={comment}
          allComments={allComments}
          hideAuthor={hideAuthor}
        />
      </CardContent>
    </Card>
  )
})
