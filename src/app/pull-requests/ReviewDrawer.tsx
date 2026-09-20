import { ChevronLeftIcon, ChevronRightIcon, Trash2 } from 'lucide-react'
import { memo, ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import { Button } from '@/app/components/ui/button'
import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import {
  SidePanel,
  SidePanelDescription,
  SidePanelHeader,
  SidePanelTitle
} from '@/app/components/ui/side-panel'
import { Textarea } from '@/app/components/ui/textarea'
import { usePendingReviewActions } from '@/app/pull-requests/use-pending-review-actions'
import { getDraftKeyForReviewBody } from '@/app/store/drafts-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  pendingReviewCommentsActions,
  type PendingReviewComment
} from '@/app/store/pending-review-comments-slice'
import { pendingReviewsActions } from '@/app/store/pending-reviews-slice'
import { useDraft } from '@/app/store/use-draft'
import { PullRequest } from '@/types/pull-request'

interface ReviewDrawerProps {
  pullRequest: PullRequest
}

export const ReviewDrawer = memo(function ReviewDrawer({
  pullRequest
}: ReviewDrawerProps): ReactElement {
  const dispatch = useAppDispatch()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id],
    shallowEqual
  )

  const isCollapsed = pendingReview?.isCollapsed ?? false

  const handleToggleCollapsed = () => {
    dispatch(
      pendingReviewsActions.setCollapsed({
        collapsed: !isCollapsed,
        pullRequestId: pullRequest.id
      })
    )
  }

  const draftKey = getDraftKeyForReviewBody(pullRequest.id)
  const { body: reviewBody, setBody: setReviewBody } = useDraft(draftKey)

  const {
    cancelReview,
    hasReviewContent,
    isSubmitting,
    pendingComments,
    submitReview
  } = usePendingReviewActions(pullRequest)

  return (
    <SidePanel
      collapsed={isCollapsed}
      open={Boolean(pendingReview)}
    >
      <div className="absolute -left-3 top-1/2 -translate-y-1/2">
        <Button
          size="icon-xs"
          variant="outline"
          onClick={handleToggleCollapsed}
        >
          {isCollapsed ? (
            <ChevronLeftIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )}
        </Button>
      </div>

      <SidePanelHeader collapsed={isCollapsed}>
        <SidePanelTitle>Finish your review</SidePanelTitle>
        <SidePanelDescription>
          Submit your review for this pull request.
        </SidePanelDescription>
      </SidePanelHeader>

      {!isCollapsed && (
        <>
          <div className="flex flex-col gap-4 p-4 pt-0">
            <Textarea
              className="min-h-32 resize-none"
              onChange={(event) => setReviewBody(event.target.value)}
              placeholder="Leave a comment..."
              value={reviewBody}
            />

            <div className="flex items-center gap-2">
              <Button
                disabled={isSubmitting || !hasReviewContent}
                onClick={() => submitReview('COMMENT')}
                size="sm"
                variant="outline"
              >
                Comment
              </Button>

              <Button
                disabled={isSubmitting || !hasReviewContent}
                onClick={() => submitReview('REQUEST_CHANGES')}
                size="sm"
                variant="outline"
              >
                Request changes
              </Button>

              <Button
                disabled={isSubmitting}
                onClick={() => submitReview('APPROVE')}
                size="sm"
              >
                Approve
              </Button>
            </div>
          </div>

          {pendingComments.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col border-t border-border">
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <span>
                  {pendingComments.length} pending{' '}
                  {pendingComments.length === 1 ? 'comment' : 'comments'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="flex flex-col gap-2">
                  {pendingComments.map((comment) => (
                    <PendingCommentItem
                      key={comment.id}
                      comment={comment}
                      onDelete={() =>
                        dispatch(
                          pendingReviewCommentsActions.removeComment({
                            pullRequestId: pullRequest.id,
                            commentId: comment.id
                          })
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div
            className={
              pendingComments.length === 0 ? 'mt-auto p-4 pt-0' : 'p-4 pt-2'
            }
          >
            <Button
              className="w-full"
              disabled={isSubmitting}
              onClick={cancelReview}
              size="sm"
              variant="ghost"
            >
              Cancel review
            </Button>
          </div>
        </>
      )}
    </SidePanel>
  )
})

interface PendingCommentItemProps {
  comment: PendingReviewComment
  onDelete: () => void
}

function PendingCommentItem({
  comment,
  onDelete
}: PendingCommentItemProps): ReactElement {
  // Get just the filename from the path
  const filename = comment.path.split('/').pop() ?? comment.path

  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span
              className="font-mono truncate"
              title={comment.path}
            >
              {filename}
            </span>
            <span>line {comment.line}</span>
          </div>
          <MarkdownBlock
            className="text-sm prose-p:my-0 prose-pre:my-1"
            content={comment.body}
            path={comment.path}
          />
        </div>

        <Button
          className="shrink-0"
          onClick={onDelete}
          size="icon-xs"
          variant="ghost"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  )
}
