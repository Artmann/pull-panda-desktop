import { Pencil } from 'lucide-react'
import { memo, useMemo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { PullRequest } from '@/types/pull-request'
import type { Check, Comment } from '@/types/pull-request-details'

import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import { SectionHeader } from '@/app/components/SectionHeader'
import { Separator } from '@/app/components/ui/separator'
import { Textarea } from '@/app/components/ui/textarea'
import { useAppSelector } from '@/app/store/hooks'

import { Activity } from './components/Activity'
import { CheckList } from './components/CheckList'
import { NewCommentForm } from './components/CommentInput'
import { IssueCard } from './components/IssueCard'
import {
  findIssuesInTheDescriptionOrInTheComments,
  type FoundIssue
} from './issue-finder'
import { useInlineEditField } from './use-inline-edit-field'

interface OverviewProps {
  pullRequest: PullRequest
}

export const Overview = memo(function Overview({
  pullRequest
}: OverviewProps): ReactElement {
  const comments: Comment[] = useAppSelector(
    (state) =>
      state.comments.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

  const checks: Check[] = useAppSelector(
    (state) =>
      state.checks.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

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
        <SectionHeader>Leave a comment</SectionHeader>

        <NewCommentForm
          owner={pullRequest.repositoryOwner}
          pullNumber={pullRequest.number}
          pullRequestId={pullRequest.id}
          repo={pullRequest.repositoryName}
        />
      </section>

      <Separator />

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
  const {
    cancel: handleCancel,
    draft,
    isEditing,
    isMerged,
    save: handleSave,
    setDraft,
    startEdit: handleStartEdit
  } = useInlineEditField({
    pullRequest,
    initialDraft: pullRequest.body ?? '',
    errorMessage: 'Failed to update description',
    buildSave: (nextBody) => {
      if (nextBody === (pullRequest.body ?? '')) {
        return null
      }

      return {
        optimisticPullRequest: { ...pullRequest, body: nextBody },
        payload: { body: nextBody }
      }
    }
  })

  if (isEditing) {
    return (
      <Textarea
        autoFocus
        className="min-h-48 text-sm resize-y"
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

  if (pullRequest.body) {
    return (
      <div className="group relative">
        <MarkdownBlock
          className="pull-request-description prose-sm *:first:mt-0!"
          content={pullRequest.body}
        />

        {!isMerged && (
          <button
            aria-label="Edit description"
            className="absolute top-0 right-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            onClick={handleStartEdit}
            title="Edit description"
            type="button"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="group relative text-muted-foreground text-sm italic">
      No description provided.
      {!isMerged && (
        <button
          aria-label="Edit description"
          className="absolute top-0 right-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          onClick={handleStartEdit}
          title="Edit description"
          type="button"
        >
          <Pencil className="size-3" />
        </button>
      )}
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
