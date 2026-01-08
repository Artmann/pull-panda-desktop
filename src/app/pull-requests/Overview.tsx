import { memo, useMemo, type ReactElement } from 'react'

import type { PullRequest } from '@/types/pullRequest'

import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import { SectionHeader } from '@/app/components/SectionHeader'
import { Separator } from '@/app/components/ui/separator'
import { useAppSelector } from '@/app/store/hooks'

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
  const details = useAppSelector(
    (state) => state.pullRequestDetails[pullRequest.id]
  )

  const comments = details?.comments ?? []
  const checks = details?.checks ?? []

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
        {pullRequest.body ? (
          <MarkdownBlock
            className="pull-request-description prose-sm *:first:mt-0!"
            content={pullRequest.body}
          />
        ) : (
          <div className="text-muted-foreground text-sm">
            No description provided.
          </div>
        )}
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
