import { memo, useMemo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { PullRequest } from '@/types/pull-request'
import type { Comment } from '@/types/pull-request-details'

import { SectionHeader } from '@/app/components/SectionHeader'
import { Separator } from '@/app/components/ui/separator'
import { useAppSelector } from '@/app/store/hooks'

import { Activity } from './components/Activity'
import { NewCommentForm } from './components/CommentInput'
import { IssueCard } from './components/IssueCard'
import {
  findIssuesInTheDescriptionOrInTheComments,
  type FoundIssue
} from './issue-finder'
import { PullRequestDescription } from './PullRequestDescription'

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
        <PullRequestDescription pullRequest={pullRequest} />
      </section>

      {issues.length > 0 && <Separator />}

      <LinkedIssues issues={issues} />

      <section className="mt-4 border-t border-border pt-6">
        <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Activity
        </h2>

        <Activity pullRequest={pullRequest} />

        <NewCommentForm
          owner={pullRequest.repositoryOwner}
          pullNumber={pullRequest.number}
          pullRequestId={pullRequest.id}
          repo={pullRequest.repositoryName}
        />
      </section>
    </article>
  )
})

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
        {issues.map((issue) => (
          <IssueCard
            key={issue.url}
            issue={issue}
          />
        ))}
      </div>
    </section>
  )
}
