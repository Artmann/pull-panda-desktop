import { useState } from 'react'
import { toast } from 'sonner'

import { updatePullRequest } from '@/app/lib/api'
import { useAppDispatch } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { PullRequest } from '@/types/pull-request'

interface SaveDecision {
  optimisticPullRequest: PullRequest
  payload: {
    body?: string
    isDraft?: boolean
    state?: 'open' | 'closed'
    title?: string
  }
}

interface UseInlineEditFieldOptions {
  pullRequest: PullRequest
  initialDraft: string
  buildSave: (draft: string) => SaveDecision | null
  errorMessage: string
}

export function useInlineEditField({
  pullRequest,
  initialDraft,
  buildSave,
  errorMessage
}: UseInlineEditFieldOptions) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const dispatch = useAppDispatch()
  const isMerged = pullRequest.state === 'MERGED'

  const startEdit = () => {
    if (isMerged) {
      return
    }

    setDraft(initialDraft)
    setIsEditing(true)
  }

  const cancel = () => {
    setIsEditing(false)
    setDraft('')
  }

  const save = () => {
    const decision = buildSave(draft)

    if (!decision) {
      setIsEditing(false)

      return
    }

    setIsEditing(false)

    const originalPullRequest = pullRequest

    dispatch(pullRequestsActions.upsertItem(decision.optimisticPullRequest))

    updatePullRequest({
      ...decision.payload,
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName
    })
      .then((updated) => {
        dispatch(pullRequestsActions.upsertItem(updated))
      })
      .catch((error: unknown) => {
        dispatch(pullRequestsActions.upsertItem(originalPullRequest))

        const message = error instanceof Error ? error.message : errorMessage

        toast.error(message)
      })
  }

  return {
    cancel,
    draft,
    isEditing,
    isMerged,
    save,
    setDraft,
    startEdit
  }
}
