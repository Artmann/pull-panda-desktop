import {
  ArrowDownToLineIcon,
  CheckIcon,
  Loader2Icon,
  SparklesIcon
} from 'lucide-react'
import { useCallback, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import { syncPullRequestDetails, updatePullRequestBranch } from '@/app/lib/api'
import { mergeOptionsActions } from '@/app/store/merge-options-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'

interface BranchSyncActionsProps {
  pullRequest: PullRequest
}

export function BranchSyncActions({
  pullRequest
}: BranchSyncActionsProps): ReactElement | null {
  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

  if (!mergeOptions) {
    return null
  }

  if (mergeOptions.mergeableState === 'behind') {
    return <UpdateBranchButton pullRequest={pullRequest} />
  }

  if (mergeOptions.mergeableState === 'dirty') {
    return <CopyConflictPromptButton pullRequest={pullRequest} />
  }

  return null
}

interface ActionButtonProps {
  pullRequest: PullRequest
}

function UpdateBranchButton({ pullRequest }: ActionButtonProps): ReactElement {
  const dispatch = useAppDispatch()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleClick = useCallback(() => {
    setIsUpdating(true)

    updatePullRequestBranch({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName
    })
      .then(() => {
        dispatch(mergeOptionsActions.clearForPullRequest(pullRequest.id))

        return syncPullRequestDetails(pullRequest.id)
      })
      .then(() => {
        toast.success(
          'Branch updated with the latest changes from the base branch.'
        )
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error'

        toast.error(`Failed to update branch: ${message}`)
      })
      .finally(() => {
        setIsUpdating(false)
      })
  }, [dispatch, pullRequest])

  return (
    <Button
      className="w-full"
      disabled={isUpdating}
      onClick={handleClick}
      size="sm"
      variant="outline"
    >
      {isUpdating ? (
        <Loader2Icon className="size-3 animate-spin" />
      ) : (
        <ArrowDownToLineIcon className="size-3" />
      )}
      {isUpdating ? 'Updating branch…' : 'Update branch'}
    </Button>
  )
}

function CopyConflictPromptButton({
  pullRequest
}: ActionButtonProps): ReactElement {
  const [hasBeenClicked, setHasBeenClicked] = useState(false)

  const handleClick = useCallback(() => {
    const prompt = formatConflictPrompt(pullRequest)

    setHasBeenClicked(true)

    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        setTimeout(() => {
          setHasBeenClicked(false)
        }, 1_400)
      })
      .catch((error: unknown) => {
        console.error('Failed to copy prompt to clipboard:', error)
        setHasBeenClicked(false)
        toast.error('Failed to copy prompt to clipboard')
      })
  }, [pullRequest])

  return (
    <Button
      className="w-full"
      onClick={handleClick}
      size="sm"
      variant="outline"
    >
      {hasBeenClicked ? (
        <CheckIcon className="size-3" />
      ) : (
        <SparklesIcon className="size-3" />
      )}
      {hasBeenClicked ? 'Copied' : 'Copy resolution prompt'}
    </Button>
  )
}

function formatConflictPrompt(pullRequest: PullRequest): string {
  const repo = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`
  const branch =
    pullRequest.headRefName ?? `pr-${pullRequest.number.toString()}`

  return [
    `I have a merge conflict on PR #${pullRequest.number.toString()} in ${repo}.`,
    `Branch: \`${branch}\``,
    '',
    'Please help me:',
    `1. Check out \`${branch}\``,
    '2. Merge the base branch into it',
    '3. Resolve all conflicts, preserving intent from both sides',
    '4. Run tests and push'
  ].join('\n')
}
