import {
  Check,
  ChevronLeft,
  Copy,
  GitBranch,
  GitCommitIcon,
  Github
} from 'lucide-react'
import { memo, ReactElement, useMemo, useState } from 'react'
import { shallowEqual } from 'react-redux'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import invariant from 'tiny-invariant'

import { updatePullRequest } from '@/app/lib/api'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { PullRequest } from '@/types/pull-request'
import type { Commit, Review } from '@/types/pull-request-details'
import { ReviewBadge } from '../components/ReviewBadge'
import { TimeAgo } from '../components/TimeAgo'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { getLatestReviews } from './get-latest-reviews'
import { PullRequestActionsMenu } from './PullRequestActionsMenu'

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
        pointerEvents: transitionProgress === 1 ? 'auto' : 'none',
        transform: `translateY(${(1 - transitionProgress) * -6}px)`
      }}
    >
      <div className="w-full max-w-240 mx-auto px-3 py-3">
        <Breadcrumbs pullRequest={pullRequest} />

        <div>
          <Title size="sm">{pullRequest.title}</Title>
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

  const reviews: Review[] = useAppSelector(
    (state) =>
      state.reviews.items.filter((r) => r.pullRequestId === pullRequest.id),
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

  const latestReviews = useMemo(() => getLatestReviews(reviews), [reviews])

  return (
    <header className="flex flex-col gap-4 p-6">
      <Breadcrumbs pullRequest={pullRequest} />

      <div>
        <InlineEditableTitle pullRequest={pullRequest} />
      </div>

      <div className="flex items-center gap-3.5">
        {pullRequest.state === 'OPEN' &&
          (pullRequest.isDraft ? (
            <Badge className="bg-status-neutral border-status-neutral-border text-status-neutral-foreground text-[10px]">
              Draft
            </Badge>
          ) : (
            <Badge className="bg-status-success border-status-success-border text-status-success-foreground text-[10px]">
              Ready for review
            </Badge>
          ))}

        {pullRequest.state === 'CLOSED' && (
          <Badge className="bg-status-danger border-status-danger-border text-status-danger-foreground text-[10px]">
            Closed
          </Badge>
        )}

        {pullRequest.state === 'MERGED' && (
          <Badge className="bg-status-merged border-status-merged-border text-status-merged-foreground text-[10px]">
            Merged
          </Badge>
        )}

        {pullRequest.headRefName && (
          <BranchName name={pullRequest.headRefName} />
        )}
      </div>

      {latestReviews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {latestReviews.map((review) => (
            <ReviewBadge
              key={review.authorLogin}
              review={review}
            />
          ))}
        </div>
      )}

      {commits.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          <GitCommitIcon className="size-3.5 shrink-0" />

          <span className="font-mono shrink-0">
            {commits.length} {commits.length === 1 ? 'commit' : 'commits'}
          </span>

          {latestCommit?.message && (
            <>
              <span className="opacity-30">·</span>

              <span className="truncate font-mono flex-1">
                {latestCommit.message.length > 80
                  ? latestCommit.message.slice(0, 80) + '…'
                  : latestCommit.message}
              </span>
            </>
          )}

          {latestCommit?.gitHubCreatedAt && (
            <span className="font-mono shrink-0">
              <TimeAgo dateTime={latestCommit.gitHubCreatedAt} />
            </span>
          )}
        </div>
      )}
    </header>
  )
})

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
        'font-semibold leading-tight text-foreground transition-all duration-200 ease-out',
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
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const dispatch = useAppDispatch()
  const isMerged = pullRequest.state === 'MERGED'

  const handleStartEdit = () => {
    if (isMerged) return
    setDraft(pullRequest.title)
    setIsEditing(true)
  }

  const handleSave = () => {
    const trimmed = draft.trim()

    if (!trimmed || trimmed === pullRequest.title) {
      setIsEditing(false)
      return
    }

    setIsEditing(false)

    const originalPr = pullRequest

    dispatch(pullRequestsActions.upsertItem({ ...pullRequest, title: trimmed }))

    updatePullRequest({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId: pullRequest.id,
      repo: pullRequest.repositoryName,
      title: trimmed
    })
      .then((updated) => {
        dispatch(pullRequestsActions.upsertItem(updated))
      })
      .catch((error: unknown) => {
        dispatch(pullRequestsActions.upsertItem(originalPr))

        const message =
          error instanceof Error ? error.message : 'Failed to update title'

        toast.error(message)
      })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setDraft('')
  }

  if (isEditing) {
    return (
      <input
        aria-label="Pull request title"
        autoFocus
        className="w-full text-[26px] font-semibold leading-tight tracking-tight text-foreground bg-transparent border-0 border-b-2 border-primary outline-none focus:ring-0 py-0.5"
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
        'font-semibold leading-tight tracking-tight text-foreground transition-all duration-200 ease-out text-[26px]',
        !isMerged && 'cursor-text hover:opacity-80'
      )}
      onClick={handleStartEdit}
    >
      {pullRequest.title}
    </h1>
  )
}

function BranchName({ name }: { name: string }): ReactElement {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(name)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <GitBranch className="size-3 shrink-0" />

      <span className="truncate font-mono max-w-80" title={name}>
        {name}
      </span>

      <button
        aria-label="Copy branch name"
        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <Check className="size-3" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  )
}

function Breadcrumbs({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
      <Button
        aria-label="Back to dashboard"
        className="size-[18px]"
        onClick={() => navigate('/')}
        size="icon-xs"
        title="Back to dashboard"
        type="button"
        variant="outline"
      >
        <ChevronLeft className="size-2" />
      </Button>

      <Breadcrumb>
        <BreadcrumbList className="gap-1 sm:gap-1 text-xs font-mono">
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

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          aria-label="Open on GitHub"
          className="size-[18px]"
          onClick={() => {
            window.electron.openUrl(
              `https://github.com/${pullRequest.repositoryOwner}/${pullRequest.repositoryName}/pull/${pullRequest.number}`
            )
          }}
          size="icon-xs"
          title="Open on GitHub"
          type="button"
          variant="outline"
        >
          <Github className="size-2" />
        </Button>

        {pullRequest.state !== 'MERGED' && (
          <PullRequestActionsMenu pullRequest={pullRequest} />
        )}
      </div>
    </div>
  )
}
