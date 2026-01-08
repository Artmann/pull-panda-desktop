import { Code2, Loader2 } from 'lucide-react'
import {
  Fragment,
  memo,
  useCallback,
  useState,
  type FormEvent,
  type ReactElement
} from 'react'

import type { PullRequest } from '@/types/pullRequest'
import type { Comment } from '@/types/pullRequestDetails'

import { TimeAgo } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { Textarea } from '@/app/components/ui/textarea'
import { createComment } from '@/app/lib/api'
import { useAuth } from '@/app/lib/store/authContext'
import { getDraftKeyForReply } from '@/app/store/draftsSlice'
import { useAppDispatch } from '@/app/store/hooks'
import {
  createOptimisticComment,
  pullRequestDetailsActions
} from '@/app/store/pullRequestDetailsSlice'
import { useDraft } from '@/app/store/useDraft'

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

interface CommentReplyProps {
  comment: Comment
  pullRequest: PullRequest
}

const CommentReply = memo(function CommentReply({
  comment,
  pullRequest
}: CommentReplyProps): ReactElement {
  const draftKey = getDraftKeyForReply(pullRequest.id, comment.gitHubId)
  const { body, setBody, clearDraft } = useDraft(draftKey)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dispatch = useAppDispatch()
  const { user } = useAuth()

  const isReviewComment = comment.gitHubReviewThreadId !== null
  const reviewCommentId = isReviewComment ? comment.gitHubNumericId ?? undefined : undefined

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()

      if (!body.trim() || isSubmitting || !user) {
        return
      }

      const trimmedBody = body.trim()

      // Create optimistic comment and add to store immediately
      const optimisticComment = createOptimisticComment({
        body: trimmedBody,
        pullRequestId: pullRequest.id,
        userLogin: user.login,
        userAvatarUrl: user.avatar_url,
        parentCommentGitHubId: comment.gitHubId,
        gitHubReviewThreadId: comment.gitHubReviewThreadId ?? undefined
      })

      dispatch(
        pullRequestDetailsActions.addComment({
          pullRequestId: pullRequest.id,
          comment: optimisticComment
        })
      )

      // Clear draft immediately for better UX
      clearDraft()
      setIsSubmitting(true)

      try {
        await createComment({
          body: trimmedBody,
          owner: pullRequest.repositoryOwner,
          pullNumber: pullRequest.number,
          repo: pullRequest.repositoryName,
          reviewCommentId
        })

        // Trigger sync to get the real comment from the server
        window.electron.syncPullRequestDetails(
          pullRequest.id,
          pullRequest.repositoryOwner,
          pullRequest.repositoryName,
          pullRequest.number
        )
      } catch (error) {
        console.error('Failed to post comment:', error)

        // Rollback optimistic comment on error
        dispatch(
          pullRequestDetailsActions.removeComment({
            pullRequestId: pullRequest.id,
            commentId: optimisticComment.id
          })
        )
      } finally {
        setIsSubmitting(false)
      }
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

interface CommentThreadCardProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor?: boolean
  pullRequest?: PullRequest
}

export const CommentThreadCard = memo(function CommentThreadCard({
  comment,
  allComments,
  hideAuthor = false,
  pullRequest
}: CommentThreadCardProps): ReactElement {
  // Only show reply form for review comments (where GitHub supports threading)
  const isReviewComment = comment.gitHubReviewThreadId !== null

  return (
    <Card className="p-0 w-full gap-0 shadow-none">
      <CardContent className="p-0 w-full">
        <CommentThread
          comment={comment}
          allComments={allComments}
          hideAuthor={hideAuthor}
        />
      </CardContent>
      {pullRequest && isReviewComment && (
        <CardFooter className="px-3 pt-1! pb-2 border-t border-border">
          <CommentReply
            comment={comment}
            pullRequest={pullRequest}
          />
        </CardFooter>
      )}
    </Card>
  )
})

interface FileCommentThreadCardProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor?: boolean
  pullRequest?: PullRequest
}

export const FileCommentThreadCard = memo(function FileCommentThreadCard({
  comment,
  allComments,
  hideAuthor = false,
  pullRequest
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
      {pullRequest && (
        <CardFooter className="px-3 pt-1! pb-2 border-t border-border">
          <CommentReply
            comment={comment}
            pullRequest={pullRequest}
          />
        </CardFooter>
      )}
    </Card>
  )
})
