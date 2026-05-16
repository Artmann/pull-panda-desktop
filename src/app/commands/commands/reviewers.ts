import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { requestReviewers } from '@/app/lib/api'
import {
  buildReviewerCandidates,
  type ReviewerCandidate,
  type ReviewerSection
} from '@/app/pull-requests/build-reviewer-candidates'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { recentReviewersActions } from '@/app/store/recent-reviewers-slice'

import { commandRegistry } from '../registry'
import { getStore } from '../store-accessor'

const sectionDescriptions: Record<ReviewerSection, string> = {
  recent: 'Recent',
  suggestion: 'Suggestion',
  'code-owner': 'Code owner',
  collaborator: 'Collaborator'
}

function describeCandidate(candidate: ReviewerCandidate): string {
  if (candidate.section === 'code-owner' && candidate.ownerPatterns.length > 0) {
    return `Code owner · ${candidate.ownerPatterns.slice(0, 2).join(', ')}`
  }

  return sectionDescriptions[candidate.section]
}

commandRegistry.register<ReviewerCandidate>({
  id: 'pr.assign-reviewer',
  label: 'Assign Reviewer',
  icon: UserPlus,
  group: 'pull request',
  isAvailable: (ctx) =>
    ctx.view === 'pr-detail' &&
    ctx.pullRequest !== undefined &&
    ctx.pullRequest.state === 'OPEN',
  param: {
    type: 'select',
    placeholder: 'Choose a reviewer...',
    getOptions: (context, query) => {
      const store = getStore()

      if (!store || !context.pullRequest) {
        return []
      }

      const state = store.getState()
      const repoFullName = `${context.pullRequest.repositoryOwner}/${context.pullRequest.repositoryName}`

      const recents = state.recentReviewers?.byRepo[repoFullName] ?? []
      const collaborators =
        state.reviewerSuggestions?.collaboratorsByRepo[repoFullName] ?? []
      const codeowners =
        state.reviewerSuggestions?.codeownersByPullRequest[
          context.pullRequest.id
        ] ?? []

      const excludeLogins = new Set(
        context.pullRequest.requestedReviewers.map(
          (reviewer) => reviewer.login
        )
      )

      if (context.pullRequest.authorLogin) {
        excludeLogins.add(context.pullRequest.authorLogin)
      }

      const candidates = buildReviewerCandidates({
        collaborators,
        codeowners,
        excludeLogins,
        query,
        recents
      })

      return candidates.slice(0, 20).map((candidate) => ({
        id: candidate.login,
        label: candidate.displayName,
        description: describeCandidate(candidate),
        value: candidate
      }))
    }
  },
  execute: (context, candidate) => {
    if (!candidate || !context.pullRequest) {
      return
    }

    const store = getStore()

    if (!store) {
      return
    }

    const pullRequest = context.pullRequest
    const previous = pullRequest.requestedReviewers
    const repoFullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`

    store.dispatch(
      pullRequestsActions.upsertItem({
        ...pullRequest,
        requestedReviewers: [
          ...previous,
          { avatarUrl: candidate.avatarUrl, login: candidate.login }
        ]
      })
    )

    store.dispatch(
      recentReviewersActions.recordUsage({
        avatarUrl: candidate.avatarUrl,
        login: candidate.login,
        repoFullName
      })
    )

    requestReviewers({
      logins: [candidate.login],
      pullRequestId: pullRequest.id
    })
      .then((updated) => {
        store.dispatch(pullRequestsActions.upsertItem(updated))
      })
      .catch((error: unknown) => {
        store.dispatch(
          pullRequestsActions.upsertItem({
            ...pullRequest,
            requestedReviewers: previous
          })
        )

        const message =
          error instanceof Error ? error.message : 'Failed to assign reviewer'

        toast.error(message)
      })
  }
})
