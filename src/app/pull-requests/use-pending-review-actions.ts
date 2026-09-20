import { useState } from 'react'
import { shallowEqual } from 'react-redux'

import {
  cancelPendingReview,
  submitPendingReview,
  type ReviewEvent
} from '@/app/pull-requests/pending-review-actions'
import { getDraftKeyForReviewBody } from '@/app/store/drafts-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import type { PendingReviewComment } from '@/app/store/pending-review-comments-slice'
import { useDraft } from '@/app/store/use-draft'
import type { PullRequest } from '@/types/pull-request'

const emptyPendingComments: PendingReviewComment[] = []

export interface PendingReviewActions {
  cancelReview: () => void
  // An approval can stand alone, but a comment or a change request needs a
  // body or at least one pending comment behind it.
  hasReviewContent: boolean
  hasPendingReview: boolean
  isSubmitting: boolean
  pendingComments: PendingReviewComment[]
  submitReview: (event: ReviewEvent) => void
}

// Submitting and cancelling a review are offered in two places — the footer bar
// and the review drawer — and both read the same draft body and pending
// comments, so the wiring lives here rather than in either component.
export function usePendingReviewActions(
  pullRequest: PullRequest
): PendingReviewActions {
  const dispatch = useAppDispatch()

  const pendingReview = useAppSelector(
    (state) => state.pendingReviews[pullRequest.id],
    shallowEqual
  )

  const pendingComments = useAppSelector(
    (state) =>
      state.pendingReviewComments[pullRequest.id] ?? emptyPendingComments,
    shallowEqual
  )

  const {
    body: reviewBody,
    setBody: setReviewBody,
    clearDraft
  } = useDraft(getDraftKeyForReviewBody(pullRequest.id))

  const [isSubmitting, setIsSubmitting] = useState(false)

  const parameters = {
    clearBody: clearDraft,
    dispatch,
    onSettled: () => setIsSubmitting(false),
    pendingReview,
    pullRequest,
    restoreBody: setReviewBody,
    reviewBody
  }

  return {
    cancelReview: () => {
      setIsSubmitting(true)

      cancelPendingReview(parameters)
    },
    hasPendingReview: Boolean(pendingReview),
    hasReviewContent: Boolean(reviewBody.trim()) || pendingComments.length > 0,
    isSubmitting,
    pendingComments,
    submitReview: (event: ReviewEvent) => {
      setIsSubmitting(true)

      submitPendingReview({ ...parameters, event, pendingComments })
    }
  }
}
