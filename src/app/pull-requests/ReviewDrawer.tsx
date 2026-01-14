import { ReactElement, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/app/components/ui/drawer'
import { Textarea } from '@/app/components/ui/textarea'
import { deleteReview, submitReview } from '@/app/lib/api'
import { getDraftKeyForReviewBody } from '@/app/store/drafts-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pendingReviewsActions } from '@/app/store/pending-reviews-slice'
import { useDraft } from '@/app/store/use-draft'
import { PullRequest } from '@/types/pull-request'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

interface ReviewDrawerProps {
  pullRequest: PullRequest
}

export function ReviewDrawer({ pullRequest }: ReviewDrawerProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const dispatch = useAppDispatch()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id]
  )

  const draftKey = getDraftKeyForReviewBody(pullRequest.id)
  const {
    body: reviewBody,
    setBody: setReviewBody,
    clearDraft
  } = useDraft(draftKey)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitReview = async (
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  ) => {
    if (!pendingReview) {
      return
    }

    const reviewId = pendingReview.gitHubNumericId

    if (typeof reviewId !== 'number' || reviewId <= 0) {
      toast.error('Review not ready yet. Please wait for sync to complete.')

      return
    }

    // Store previous state for rollback
    const previousReview = { ...pendingReview }
    const previousBody = reviewBody

    // Optimistically update UI
    setIsSubmitting(true)
    clearDraft()
    dispatch(
      pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
    )

    try {
      await submitReview({
        body: reviewBody || undefined,
        event,
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        repo: pullRequest.repositoryName,
        reviewId
      })

      const eventLabels = {
        APPROVE: 'approved',
        COMMENT: 'submitted',
        REQUEST_CHANGES: 'requested changes on'
      }

      toast.success(`Successfully ${eventLabels[event]} the pull request`)
    } catch (error) {
      // Rollback on error
      dispatch(
        pendingReviewsActions.setReview({
          pullRequestId: pullRequest.id,
          review: previousReview
        })
      )
      setReviewBody(previousBody)

      const message =
        error instanceof Error ? error.message : 'Failed to submit review'

      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )
    }
  }

  const handleCancelReview = async () => {
    if (!pendingReview) {
      return
    }

    const reviewId = pendingReview.gitHubNumericId

    if (typeof reviewId !== 'number' || reviewId <= 0) {
      // No review on GitHub yet, just clear locally
      dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )

      return
    }

    // Store previous state for rollback
    const previousReview = { ...pendingReview }
    const previousBody = reviewBody

    // Optimistically update UI
    setIsSubmitting(true)
    clearDraft()
    dispatch(
      pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
    )

    try {
      await deleteReview({
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        repo: pullRequest.repositoryName,
        reviewId
      })
    } catch (error) {
      // Rollback on error
      dispatch(
        pendingReviewsActions.setReview({
          pullRequestId: pullRequest.id,
          review: previousReview
        })
      )
      setReviewBody(previousBody)

      const message =
        error instanceof Error ? error.message : 'Failed to cancel review'

      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer
      direction="right"
      modal={false}
      open={Boolean(pendingReview)}
      onOpenChange={handleOpenChange}
    >
      <DrawerContent
        className="flex flex-col transition-all"
        style={{ width: isCollapsed ? 10 : undefined }}
      >
        <div className="absolute -left-3 top-1/2 -translate-y-1/2">
          <Button
            size="icon-xs"
            variant="outline"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronLeftIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
          </Button>
        </div>

        <DrawerHeader>
          <DrawerTitle>Finish your review</DrawerTitle>
          <DrawerDescription>
            Submit your review for this pull request.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 p-4">
          <Textarea
            className="min-h-32 resize-none"
            onChange={(event) => setReviewBody(event.target.value)}
            placeholder="Leave a comment..."
            value={reviewBody}
          />

          <div className="flex items-center gap-2">
            <Button
              disabled={isSubmitting || !reviewBody.trim()}
              onClick={() => handleSubmitReview('COMMENT')}
              size="sm"
              variant="outline"
            >
              Comment
            </Button>

            <Button
              disabled={isSubmitting || !reviewBody.trim()}
              onClick={() => handleSubmitReview('REQUEST_CHANGES')}
              size="sm"
              variant="outline"
            >
              Request changes
            </Button>

            <Button
              disabled={isSubmitting}
              onClick={() => handleSubmitReview('APPROVE')}
              size="sm"
            >
              Approve
            </Button>
          </div>
        </div>

        <div className="mt-auto p-4 pt-0">
          <Button
            className="w-full"
            disabled={isSubmitting}
            onClick={handleCancelReview}
            size="sm"
            variant="ghost"
          >
            Cancel review
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
