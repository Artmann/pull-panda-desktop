import { useCallback, useEffect, useMemo, type RefObject } from 'react'

import { removeReviewers, requestReviewers } from '@/app/lib/api'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { recentReviewersActions } from '@/app/store/recent-reviewers-slice'
import type { PullRequest } from '@/types/pull-request'

import type { CodeownerEntry, Collaborator } from '@/app/lib/api'
import type { RecentReviewer } from '@/app/store/recent-reviewers-slice'

import {
  buildReviewerCandidates,
  type ReviewerCandidate,
  type ReviewerSection
} from './build-reviewer-candidates'

const emptyCodeowners: CodeownerEntry[] = []
const emptyCollaborators: Collaborator[] = []
const emptyRecents: RecentReviewer[] = []

export function groupCandidatesBySection(
  candidates: ReviewerCandidate[]
): Map<ReviewerSection, ReviewerCandidate[]> {
  const grouped = new Map<ReviewerSection, ReviewerCandidate[]>()

  for (const candidate of candidates) {
    const existing = grouped.get(candidate.section) ?? []

    existing.push(candidate)
    grouped.set(candidate.section, existing)
  }

  return grouped
}

/** Closes the picker on a click outside `containerRef` or on Escape. */
export function useDismissOnOutsideClick(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: () => void
): void {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onDismiss()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [containerRef, isOpen, onDismiss])
}

/** Reviewer candidates for the pull request, grouped by picker section. */
export function useReviewerCandidates(
  pullRequest: PullRequest,
  query: string
): Map<ReviewerSection, ReviewerCandidate[]> {
  const repoFullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`

  const recents = useAppSelector(
    (state) => state.recentReviewers?.byRepo[repoFullName] ?? emptyRecents
  )

  const collaborators = useAppSelector(
    (state) =>
      state.reviewerSuggestions?.collaboratorsByRepo[repoFullName] ??
      emptyCollaborators
  )

  const codeowners = useAppSelector(
    (state) =>
      state.reviewerSuggestions?.codeownersByPullRequest[pullRequest.id] ??
      emptyCodeowners
  )

  return useMemo(() => {
    const excludeLogins = pullRequest.authorLogin
      ? new Set([pullRequest.authorLogin])
      : undefined

    const candidates = buildReviewerCandidates({
      collaborators,
      codeowners,
      excludeLogins,
      query,
      recents
    })

    return groupCandidatesBySection(candidates)
  }, [collaborators, codeowners, pullRequest.authorLogin, query, recents])
}

/** Requests or removes a reviewer optimistically. */
export function useToggleReviewer(
  pullRequest: PullRequest,
  requestedLogins: Set<string>
): (candidate: ReviewerCandidate) => void {
  const dispatch = useAppDispatch()
  const repoFullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`

  return useCallback(
    (candidate: ReviewerCandidate) => {
      const isRequested = requestedLogins.has(candidate.login)
      const previous = pullRequest.requestedReviewers

      const optimisticReviewers = isRequested
        ? previous.filter((reviewer) => reviewer.login !== candidate.login)
        : [
            ...previous,
            { avatarUrl: candidate.avatarUrl, login: candidate.login }
          ]

      const action = isRequested ? removeReviewers : requestReviewers

      runOptimisticMutation({
        optimistic: () => {
          dispatch(
            pullRequestsActions.upsertItem({
              ...pullRequest,
              requestedReviewers: optimisticReviewers
            })
          )

          if (!isRequested) {
            dispatch(
              recentReviewersActions.recordUsage({
                avatarUrl: candidate.avatarUrl,
                login: candidate.login,
                repoFullName
              })
            )
          }
        },
        request: () =>
          action({ logins: [candidate.login], pullRequestId: pullRequest.id }),
        commit: (updated) => dispatch(pullRequestsActions.upsertItem(updated)),
        rollback: () =>
          dispatch(
            pullRequestsActions.upsertItem({
              ...pullRequest,
              requestedReviewers: previous
            })
          ),
        errorMessage: isRequested
          ? 'Failed to remove reviewer'
          : 'Failed to request reviewer'
      })
    },
    [dispatch, pullRequest, repoFullName, requestedLogins]
  )
}
