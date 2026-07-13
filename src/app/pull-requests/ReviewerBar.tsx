import { memo, useMemo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import { UserAvatar } from '@/app/components/UserAvatar'
import { useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'
import type { Review } from '@/types/pull-request-details'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '../components/ui/tooltip'
import { getBuiltInReviewer } from './built-in-reviewers'
import { getLatestReviews } from './get-latest-reviews'
import { ReviewerPicker } from './ReviewerPicker'
import { useReviewerSuggestionsLoader } from './use-reviewer-suggestions-loader'
import {
  ReviewerStatusIndicator,
  type ReviewerStatus
} from './ReviewerStatusIndicator'

interface ReviewerEntry {
  avatarUrl: string
  displayName: string
  login: string
  status: ReviewerStatus
}

interface ReviewerBarProps {
  pullRequest: PullRequest
}

function reviewStateToStatus(review: Review | undefined): ReviewerStatus {
  if (!review) {
    return 'pending'
  }

  if (review.state === 'APPROVED') {
    return 'approved'
  }

  if (review.state === 'CHANGES_REQUESTED') {
    return 'changes-requested'
  }

  if (review.state === 'COMMENTED') {
    return 'commented'
  }

  return 'pending'
}

function statusTooltip(login: string, status: ReviewerStatus): string {
  if (status === 'approved') return `${login} approved these changes`
  if (status === 'changes-requested') return `${login} requested changes`
  if (status === 'commented') return `${login} left review comments`

  return `${login} — review pending`
}

export const ReviewerBar = memo(function ReviewerBar({
  pullRequest
}: ReviewerBarProps): ReactElement {
  useReviewerSuggestionsLoader(pullRequest)

  const reviews = useAppSelector(
    (state) =>
      state.reviews.items.filter((r) => r.pullRequestId === pullRequest.id),
    shallowEqual
  )

  const entries = useMemo<ReviewerEntry[]>(() => {
    const latestByAuthor = new Map(
      getLatestReviews(reviews).map((review) => [
        review.authorLogin ?? '',
        review
      ])
    )

    const seen = new Set<string>()
    const result: ReviewerEntry[] = []

    const buildEntry = (
      login: string,
      avatarUrl: string,
      status: ReviewerStatus
    ): ReviewerEntry => {
      const builtIn = getBuiltInReviewer(login)

      return {
        avatarUrl: builtIn?.avatarUrl ?? avatarUrl,
        displayName: builtIn?.displayName ?? login,
        login,
        status
      }
    }

    for (const requested of pullRequest.requestedReviewers) {
      const review = latestByAuthor.get(requested.login)

      result.push(
        buildEntry(
          requested.login,
          requested.avatarUrl,
          reviewStateToStatus(review)
        )
      )

      seen.add(requested.login)
    }

    // Include anyone who has reviewed but is no longer in the requested list
    // (e.g. submitted their review and was auto-cleared by GitHub).
    for (const review of latestByAuthor.values()) {
      const login = review.authorLogin

      if (!login || seen.has(login)) {
        continue
      }

      result.push(
        buildEntry(
          login,
          review.authorAvatarUrl ?? '',
          reviewStateToStatus(review)
        )
      )

      seen.add(login)
    }

    return result
  }, [pullRequest.requestedReviewers, reviews])

  const isEmpty = entries.length === 0

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2">
      {!isEmpty && (
        <>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Reviewers
          </span>

          <div className="flex items-center -space-x-1.5">
            {entries.map((entry) => (
              <Tooltip key={entry.login}>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <UserAvatar
                      avatarUrl={entry.avatarUrl}
                      login={entry.displayName}
                    />
                    <ReviewerStatusIndicator status={entry.status} />
                  </div>
                </TooltipTrigger>

                <TooltipContent>
                  {statusTooltip(entry.displayName, entry.status)}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </>
      )}

      <ReviewerPicker
        pullRequest={pullRequest}
        variant={isEmpty ? 'cta' : 'compact'}
      />
    </div>
  )
})
