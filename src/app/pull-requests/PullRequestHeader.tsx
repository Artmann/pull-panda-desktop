import { memo, ReactElement, useMemo } from 'react'
import { shallowEqual } from 'react-redux'
import invariant from 'tiny-invariant'

import { getLatestChecks } from '@/app/components/check-rollup'
import { useAppSelector } from '@/app/store/hooks'
import { PullRequest } from '@/types/pull-request'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import { cn } from '../lib/utils'
import { PullRequestMetaRow } from './PullRequestMetaRow'
import { PullRequestStatusStrip } from './PullRequestStatusStrip'
import { buildStatusSummary, type StatusCell } from './status-summary'
import { useDerivedTaskGroups } from './tasks/use-derived-tasks'
import { useInlineEditField } from './use-inline-edit-field'

export const PullRequestHeader = memo(function PullRequestHeader({
  onSelectTab,
  pullRequest
}: {
  onSelectTab: (tab: StatusCell['tab']) => void
  pullRequest: PullRequest
}): ReactElement {
  invariant(pullRequest, 'PullRequestHeader requires a pull request')

  return (
    <header className="flex flex-col gap-2.5 max-w-content px-6 pt-7">
      <Breadcrumbs pullRequest={pullRequest} />

      <InlineEditableTitle pullRequest={pullRequest} />

      <PullRequestMetaRow pullRequest={pullRequest} />

      {pullRequest.state === 'OPEN' && (
        <div className="mt-3">
          <StatusStrip
            onSelectTab={onSelectTab}
            pullRequest={pullRequest}
          />
        </div>
      )}
    </header>
  )
})

function StatusStrip({
  onSelectTab,
  pullRequest
}: {
  onSelectTab: (tab: StatusCell['tab']) => void
  pullRequest: PullRequest
}): ReactElement {
  const checks = useAppSelector(
    (state) =>
      state.checks.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

  const taskGroups = useDerivedTaskGroups(pullRequest)
  const baseName = pullRequest.baseRefName ?? 'the base branch'

  const summary = useMemo(
    () =>
      buildStatusSummary({
        baseName,
        checks: getLatestChecks(checks),
        taskGroups
      }),
    [baseName, checks, taskGroups]
  )

  return (
    <PullRequestStatusStrip
      onSelectTab={onSelectTab}
      summary={summary}
    />
  )
}

function InlineEditableTitle({
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
    initialDraft: pullRequest.title,
    errorMessage: 'Failed to update title',
    buildSave: (nextValue) => {
      const trimmed = nextValue.trim()

      if (!trimmed || trimmed === pullRequest.title) {
        return null
      }

      return {
        optimisticPullRequest: { ...pullRequest, title: trimmed },
        payload: { title: trimmed }
      }
    }
  })

  if (isEditing) {
    return (
      <input
        aria-label="Pull request title"
        autoFocus
        className="w-full text-2xl font-semibold leading-tight tracking-tight text-foreground bg-transparent border-0 border-b-2 border-primary outline-none focus:ring-0 py-0.5"
        value={draft}
        onBlur={handleSave}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            handleSave()
          } else if (event.key === 'Escape') {
            handleCancel()
          }
        }}
      />
    )
  }

  return (
    <h1
      className={cn(
        'font-semibold leading-tight tracking-tight text-foreground text-pretty text-2xl',
        !isMerged && 'cursor-text hover:opacity-80'
      )}
      onClick={isMerged ? undefined : handleStartEdit}
    >
      {pullRequest.title}
    </h1>
  )
}

function Breadcrumbs({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Breadcrumb>
        <BreadcrumbList className="gap-1 sm:gap-1 text-xs">
          <BreadcrumbItem>
            <BreadcrumbPage>
              <span className="text-muted-foreground">
                {pullRequest.repositoryOwner}
              </span>
            </BreadcrumbPage>
          </BreadcrumbItem>

          <BreadcrumbSeparator className="[&>svg]:hidden">
            <span className="opacity-40">/</span>
          </BreadcrumbSeparator>

          <BreadcrumbItem>
            <BreadcrumbPage>
              <span className="text-muted-foreground">
                {pullRequest.repositoryName}
              </span>
            </BreadcrumbPage>
          </BreadcrumbItem>

          <BreadcrumbSeparator className="[&>svg]:hidden">
            <span className="opacity-40">/</span>
          </BreadcrumbSeparator>

          <BreadcrumbItem>
            <BreadcrumbPage>
              <span className="text-muted-foreground">
                #{pullRequest.number}
              </span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
