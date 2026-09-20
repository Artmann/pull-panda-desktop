import { toast } from 'sonner'

import { deleteReview, submitReview } from '@/app/lib/api'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import type { AppDispatch } from '@/app/store'
import {
  pendingReviewCommentsActions,
  type PendingReviewComment
} from '@/app/store/pending-review-comments-slice'
import {
  pendingReviewsActions,
  type PendingReview
} from '@/app/store/pending-reviews-slice'
import type { PullRequest } from '@/types/pull-request'

// Submitting and cancelling a pending review, shared by the ReviewDrawer and
// the footer action bar. Both surfaces read the same draft body and pending
// comments out of the store, so either can finish a review.

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

const eventLabels: Record<ReviewEvent, string> = {
  APPROVE: 'approved',
  COMMENT: 'submitted',
  REQUEST_CHANGES: 'requested changes on'
}

interface PendingReviewActionParameters {
  dispatch: AppDispatch
  pendingReview: PendingReview | undefined
  pullRequest: PullRequest
  reviewBody: string
  // The draft body lives in the drafts slice behind `useDraft`, so callers hand
  // us its setter rather than us reaching for the key ourselves.
  clearBody: () => void
  restoreBody: (body: string) => void
  onSettled?: () => void
}

interface SubmitPendingReviewParameters extends PendingReviewActionParameters {
  event: ReviewEvent
  pendingComments: PendingReviewComment[]
}

export function submitPendingReview({
  clearBody,
  dispatch,
  event,
  onSettled,
  pendingComments,
  pendingReview,
  pullRequest,
  restoreBody,
  reviewBody
}: SubmitPendingReviewParameters): void {
  if (!pendingReview) {
    onSettled?.()

    return
  }

  const reviewId = pendingReview.gitHubNumericId

  // A pending review is only submittable once the sync has given it a real
  // GitHub id; before that the optimistic record carries a placeholder.
  if (typeof reviewId !== 'number' || reviewId <= 0) {
    toast.error('Review not ready yet. Please wait for sync to complete.')
    onSettled?.()

    return
  }

  const previousReview = { ...pendingReview }
  const previousBody = reviewBody
  const previousComments = [...pendingComments]

  runOptimisticMutation({
    optimistic: () => {
      clearBody()
      dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )
      dispatch(
        pendingReviewCommentsActions.clearComments({
          pullRequestId: pullRequest.id
        })
      )
    },
    request: () =>
      submitReview({
        body: reviewBody || undefined,
        comments:
          pendingComments.length > 0
            ? pendingComments.map((comment) => ({
                body: comment.body,
                line: comment.line,
                path: comment.path,
                side: comment.side
              }))
            : undefined,
        event,
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        repo: pullRequest.repositoryName,
        reviewId
      }),
    commit: () => {
      toast.success(`Successfully ${eventLabels[event]} the pull request`)
    },
    rollback: () => {
      dispatch(
        pendingReviewsActions.setReview({
          pullRequestId: pullRequest.id,
          review: previousReview
        })
      )
      restoreBody(previousBody)

      for (const comment of previousComments) {
        dispatch(
          pendingReviewCommentsActions.addComment({
            pullRequestId: pullRequest.id,
            comment
          })
        )
      }
    },
    settled: onSettled,
    errorMessage: 'Failed to submit review'
  })
}

export function cancelPendingReview({
  clearBody,
  dispatch,
  onSettled,
  pendingReview,
  pullRequest,
  restoreBody,
  reviewBody
}: PendingReviewActionParameters): void {
  if (!pendingReview) {
    onSettled?.()

    return
  }

  const reviewId = pendingReview.gitHubNumericId

  // Nothing reached GitHub yet, so there is nothing to delete remotely.
  if (typeof reviewId !== 'number' || reviewId <= 0) {
    dispatch(
      pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
    )
    onSettled?.()

    return
  }

  const previousReview = { ...pendingReview }
  const previousBody = reviewBody

  runOptimisticMutation({
    optimistic: () => {
      clearBody()
      dispatch(
        pendingReviewsActions.clearReview({ pullRequestId: pullRequest.id })
      )
    },
    request: () =>
      deleteReview({
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        repo: pullRequest.repositoryName,
        reviewId
      }),
    rollback: () => {
      dispatch(
        pendingReviewsActions.setReview({
          pullRequestId: pullRequest.id,
          review: previousReview
        })
      )
      restoreBody(previousBody)
    },
    settled: onSettled,
    errorMessage: 'Failed to cancel review'
  })
}
