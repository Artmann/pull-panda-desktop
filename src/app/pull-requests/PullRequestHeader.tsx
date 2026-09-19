import { ArrowRight, GitBranch, GitCommitIcon } from 'lucide-react'
import { memo, ReactElement, useMemo } from 'react'
import { shallowEqual } from 'react-redux'
import invariant from 'tiny-invariant'

import { useAppSelector } from '@/app/store/hooks'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '../components/ui/tooltip'
import { useInlineEditField } from './use-inline-edit-field'
import { PullRequest } from '@/types/pull-request'
import type { Commit } from '@/types/pull-request-details'
import { TimeAgo } from '../components/TimeAgo'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'
import { parseCommitMessage } from './parse-commit-message'
import { PullRequestMetaRow } from './PullRequestMetaRow'

export const StickyPullRequestHeader = memo(function StickyPullRequestHeader({
  pullRequest,
  transitionProgress
}: {
  pullRequest: PullRequest
  transitionProgress: number
}): ReactElement {
  invariant(pullRequest, 'PullRequestHeader requires a pull request')
  invariant(transitionProgress !== undefined, 'transitionProgress is required')
  invariant(
    transitionProgress >= 0 && transitionProgress <= 1,
    'transitionProgress must be between 0 and 1'
  )

  return (
    <header
      className={`
        fixed top-8 left-0 right-0 z-50
        flex flex-col gap-2
        bg-background
        border-b border-border
        transition-none
      `}
      style={{
        display: transitionProgress === 0 ? 'none' : 'flex',
        opacity: transitionProgress,
        pointerEvents: transitionProgress > 0.5 ? 'auto' : 'none',
        transform: `translateY(${(1 - transitionProgress) * -6}px)`
      }}
    >
      <div className="w-full max-w-wide mx-auto px-6 py-3">
        <Breadcrumbs pullRequest={pullRequest} />

        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 flex-1 truncate">
            <Title size="sm">{pullRequest.title}</Title>
          </div>

          {pullRequest.headRefName && (
            <div className="shrink-0">
              <BranchName
                baseName={pullRequest.baseRefName}
                name={pullRequest.headRefName}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  )
})

export const PullRequestHeader = memo(function PullRequestHeader({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  invariant(pullRequest, 'PullRequestHeader requires a pull request')

  const commits: Commit[] = useAppSelector(
    (state) =>
      state.commits.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

  const latestCommit = useMemo(() => {
    if (commits.length === 0) {
      return null
    }

    return [...commits].sort((a, b) => {
      const dateA = a.gitHubCreatedAt ?? ''
      const dateB = b.gitHubCreatedAt ?? ''

      return dateB.localeCompare(dateA)
    })[0]
  }, [commits])

  return (
    <header className="flex flex-col gap-4 max-w-content px-6 py-6">
      <Breadcrumbs pullRequest={pullRequest} />

      <div>
        <InlineEditableTitle pullRequest={pullRequest} />
      </div>

      <div className="flex items-center gap-3.5">
        {pullRequest.state === 'OPEN' &&
          (pullRequest.isDraft ? (
            <Badge className="bg-status-neutral border-status-neutral-border text-status-neutral-foreground text-2xs">
              Draft
            </Badge>
          ) : (
            <Badge className="bg-status-success border-status-success-border text-status-success-foreground text-2xs">
              Ready for review
            </Badge>
          ))}

        {pullRequest.state === 'CLOSED' && (
          <Badge className="bg-status-danger border-status-danger-border text-status-danger-foreground text-2xs">
            Closed
          </Badge>
        )}

        {pullRequest.state === 'MERGED' && (
          <Badge className="bg-status-merged border-status-merged-border text-status-merged-foreground text-2xs">
            Merged
          </Badge>
        )}

        {pullRequest.headRefName && (
          <BranchName
            baseName={pullRequest.baseRefName}
            name={pullRequest.headRefName}
          />
        )}
      </div>

      <PullRequestMetaRow pullRequest={pullRequest} />

      {commits.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
          <GitCommitIcon className="size-3.5 shrink-0" />

          <span className="shrink-0 tabular-nums">
            {commits.length} {commits.length === 1 ? 'commit' : 'commits'}
          </span>

          {latestCommit?.message && (
            <>
              <span className="opacity-40">·</span>

              <Tooltip>
                <TooltipTrigger className="truncate flex-1 text-left cursor-default">
                  <CommitSubject message={latestCommit.message} />
                </TooltipTrigger>

                <TooltipContent className="max-w-content whitespace-pre-wrap text-left">
                  {latestCommit.message}
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {latestCommit?.gitHubCreatedAt && (
            <span className="shrink-0 tabular-nums">
              <TimeAgo dateTime={latestCommit.gitHubCreatedAt} />
            </span>
          )}
        </div>
      )}
    </header>
  )
})

/**
 * The subject line of a commit message, with `backticked` spans rendered as
 * code.
 *
 * Commit subjects are written in markdown by habit even though nothing renders
 * them, so the backticks used to show up literally — and the body ran straight
 * into the subject because the whole raw message was printed. The mono face
 * comes from preflight's `code` rule.
 */
function CommitSubject({ message }: { message: string }): ReactElement {
  const { title } = parseCommitMessage(message)
  const segments = title.split(/`([^`]+)`/)

  return (
    <>
      {segments.map((segment, index) =>
        index % 2 === 0 ? (
          segment
        ) : (
          <code
            className="rounded-xs bg-muted/60 px-1 py-0.5"
            key={index}
          >
            {segment}
          </code>
        )
      )}
    </>
  )
}

function Title({
  children,
  size
}: {
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}): ReactElement {
  return (
    <h1
      className={cn(
        'font-semibold leading-tight tracking-tight text-foreground transition-all duration-200 ease-out',
        size === 'sm' ? 'text-xl' : 'text-2xl'
      )}
    >
      {children}
    </h1>
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
        'font-semibold leading-tight tracking-tight text-foreground transition-all duration-200 ease-out text-2xl',
        !isMerged && 'cursor-text hover:opacity-80'
      )}
      onClick={isMerged ? undefined : handleStartEdit}
    >
      {pullRequest.title}
    </h1>
  )
}

function BranchName({
  baseName,
  name
}: {
  baseName?: string | null
  name: string
}): ReactElement {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <GitBranch className="size-3 shrink-0" />

      <span
        className="truncate font-mono max-w-80"
        title={name}
      >
        {name}
      </span>

      {baseName && (
        <>
          <ArrowRight
            aria-hidden
            className="size-3 shrink-0 opacity-60"
          />

          <span
            className="truncate font-mono max-w-40"
            title={`Merges into ${baseName}`}
          >
            {baseName}
          </span>
        </>
      )}
    </div>
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
              <span className="text-foreground/80">
                {pullRequest.repositoryOwner}
              </span>
            </BreadcrumbPage>
          </BreadcrumbItem>

          <BreadcrumbSeparator className="[&>svg]:hidden">
            <span className="opacity-40">/</span>
          </BreadcrumbSeparator>

          <BreadcrumbItem>
            <BreadcrumbPage>
              <span className="text-foreground/80">
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
