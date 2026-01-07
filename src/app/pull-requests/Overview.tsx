import { memo, useMemo, type ReactElement } from 'react'

import type { PullRequest } from '@/types/pullRequest'
import type { Check, Comment, Review } from '@/types/pullRequestDetails'

import { SectionHeader } from '@/app/components/SectionHeader'

import { Activity } from './components/Activity'
import { CheckList } from './components/CheckList'
import { IssueCard } from './components/IssueCard'
import {
  findIssuesInTheDescriptionOrInTheComments,
  type FoundIssue
} from './issue-finder'

interface OverviewProps {
  checks: Check[]
  comments: Comment[]
  pullRequest: PullRequest
  reviews: Review[]
}

export const Overview = memo(function Overview({
  checks,
  comments,
  pullRequest,
  reviews
}: OverviewProps): ReactElement {
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

  const htmlContent = useMemo(
    () => ({
      __html: pullRequest.bodyHtml ?? ''
    }),
    [pullRequest.bodyHtml]
  )

  return (
    <article className="flex flex-col gap-8 text-sm pt-6">
      <section>
        {pullRequest.bodyHtml ? (
          <div className="prose prose-sm dark:prose-invert pull-request-description max-w-none w-full [&>div>:first-child]:mt-0!">
            <div dangerouslySetInnerHTML={htmlContent} />
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            No description provided.
          </div>
        )}
      </section>

      <LinkedIssues issues={issues} />

      {checks && checks.length > 0 && (
        <section>
          <SectionHeader>Checks</SectionHeader>

          <CheckList checks={checks} />
        </section>
      )}

      <section>
        <SectionHeader>Activity</SectionHeader>

        <Activity
          comments={comments}
          pullRequest={pullRequest}
          reviews={reviews}
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
