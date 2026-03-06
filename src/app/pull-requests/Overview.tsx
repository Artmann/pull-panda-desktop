import { memo, useMemo, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

import type { PullRequest } from '@/types/pull-request'
import type { Check, Comment } from '@/types/pull-request-details'

import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import { SectionHeader } from '@/app/components/SectionHeader'
import { Separator } from '@/app/components/ui/separator'
import { updatePullRequest } from '@/app/lib/api'
import { useChecks } from '@/app/lib/queries/use-checks'
import { useComments } from '@/app/lib/queries/use-comments'
import {
  clearPullRequestInFlight,
  markPullRequestInFlight,
  useUpsertPullRequest
} from '@/app/lib/queries/use-pull-requests'

import { Activity } from './components/Activity'
import { CheckList } from './components/CheckList'
import { IssueCard } from './components/IssueCard'
import {
  findIssuesInTheDescriptionOrInTheComments,
  type FoundIssue
} from './issue-finder'

interface OverviewProps {
  pullRequest: PullRequest
}

export const Overview = memo(function Overview({
  pullRequest
}: OverviewProps): ReactElement {
  const comments: Comment[] = useComments(pullRequest.id)
  const checks: Check[] = useChecks(pullRequest.id)

  const issues = useMemo(
    () =>
      findIssuesInTheDescriptionOrInTheComments(
        pullRequest.repositoryOwner,
        pullRequest.repositoryName,
        pullRequest.body,
        comments
      ),
    [
      comments,
      pullRequest.body,
      pullRequest.repositoryOwner,
      pullRequest.repositoryName
    ]
  )

  return (
    <article className="flex flex-col gap-8 text-sm pt-6">
      <section>
        <InlineEditableBody pullRequest={pullRequest} />
      </section>

      {issues.length > 0 && <Separator />}

      <LinkedIssues issues={issues} />

      <Separator />

      {checks && checks.length > 0 && (
        <>
          <section>
            <SectionHeader>Checks</SectionHeader>

            <CheckList checks={checks} />
          </section>

          <Separator />
        </>
      )}

      <section>
        <SectionHeader>Activity</SectionHeader>

        <Activity pullRequest={pullRequest} />
      </section>
    </article>
  )
})

function InlineEditableBody({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [optimisticBody, setOptimisticBody] = useState<string | null>(null)
  const upsertPullRequest = useUpsertPullRequest()
  const isMerged = pullRequest.state === 'MERGED'

  // Clear local optimistic body once the prop catches up
  if (optimisticBody !== null && pullRequest.body === optimisticBody) {
    setOptimisticBody(null)
  }

  const displayBody = optimisticBody ?? pullRequest.body

  const handleStartEdit = () => {
    if (isMerged) return
    setDraft(pullRequest.body ?? '')
    setIsEditing(true)
  }

  const handleSave = () => {
    if (draft === (pullRequest.body ?? '')) {
      setIsEditing(false)
      return
    }

    setIsEditing(false)

    const originalPr = pullRequest
    const newBody = draft

    setOptimisticBody(newBody)
    markPullRequestInFlight(pullRequest.id)
    upsertPullRequest({ ...pullRequest, body: newBody })

    updatePullRequest({
      body: newBody,
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName
    })
      .then((updated) => {
        clearPullRequestInFlight(pullRequest.id)
        upsertPullRequest(updated)
      })
      .catch((error) => {
        clearPullRequestInFlight(pullRequest.id)
        setOptimisticBody(null)
        upsertPullRequest(originalPr)

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to update description'

        toast.error(message)
      })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setDraft('')
  }

  if (isEditing) {
    return (
      <textarea
        autoFocus
        className="w-full resize-y bg-muted/40 border border-border rounded-md p-3 text-sm font-inherit outline-none focus:ring-2 focus:ring-primary/50 min-h-32"
        rows={8}
        value={draft}
        onBlur={handleSave}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            handleCancel()
          }
        }}
      />
    )
  }

  if (displayBody) {
    return (
      <div
        className={!isMerged ? 'cursor-text' : undefined}
        onClick={handleStartEdit}
      >
        <MarkdownBlock
          className="pull-request-description prose-sm *:first:mt-0!"
          content={displayBody}
        />
      </div>
    )
  }

  return (
    <div
      className={
        !isMerged
          ? 'cursor-text text-muted-foreground text-sm'
          : 'text-muted-foreground text-sm'
      }
      onClick={!isMerged ? handleStartEdit : undefined}
    >
      No description provided.
    </div>
  )
}

function LinkedIssues({
  issues
}: {
  issues: FoundIssue[]
}): ReactElement | null {
  if (issues.length === 0) {
    return null
  }

  return (
    <section className="w-full">
      <SectionHeader>Linked Issues</SectionHeader>

      <div className="flex flex-col gap-2 w-full">
        {issues.map((issue, index) => (
          <IssueCard
            key={index}
            issue={issue}
          />
        ))}
      </div>
    </section>
  )
}
