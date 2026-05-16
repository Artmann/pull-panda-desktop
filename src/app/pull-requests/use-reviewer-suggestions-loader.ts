import { useEffect } from 'react'

import { fetchCodeowners, fetchCollaborators } from '@/app/lib/api'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { reviewerSuggestionsActions } from '@/app/store/reviewer-suggestions-slice'
import type { PullRequest } from '@/types/pull-request'

export function useReviewerSuggestionsLoader(pullRequest: PullRequest): void {
  const dispatch = useAppDispatch()
  const repoFullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`

  const hasCollaborators = useAppSelector((state) =>
    Boolean(state.reviewerSuggestions?.collaboratorsByRepo[repoFullName])
  )

  const hasCodeowners = useAppSelector((state) =>
    Boolean(state.reviewerSuggestions?.codeownersByPullRequest[pullRequest.id])
  )

  useEffect(() => {
    if (hasCollaborators) {
      return
    }

    fetchCollaborators({
      owner: pullRequest.repositoryOwner,
      repo: pullRequest.repositoryName
    })
      .then((items) => {
        dispatch(
          reviewerSuggestionsActions.setCollaborators({
            items,
            repoFullName
          })
        )
      })
      .catch(() => {
        // Silent — the picker and command palette gracefully show fewer options.
      })
  }, [
    dispatch,
    hasCollaborators,
    pullRequest.repositoryName,
    pullRequest.repositoryOwner,
    repoFullName
  ])

  useEffect(() => {
    if (hasCodeowners) {
      return
    }

    fetchCodeowners({
      owner: pullRequest.repositoryOwner,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName
    })
      .then((items) => {
        dispatch(
          reviewerSuggestionsActions.setCodeowners({
            items,
            pullRequestId: pullRequest.id
          })
        )
      })
      .catch(() => {
        // Silent.
      })
  }, [
    dispatch,
    hasCodeowners,
    pullRequest.id,
    pullRequest.repositoryName,
    pullRequest.repositoryOwner
  ])
}
