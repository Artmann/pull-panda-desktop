import { ExternalLinkIcon, GitCommitIcon, GitPullRequest } from 'lucide-react'
import { memo, ReactElement, useMemo, useState } from 'react'
import { shallowEqual } from 'react-redux'
import { toast } from 'sonner'
import invariant from 'tiny-invariant'

import { updatePullRequest } from '@/app/lib/api'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { PullRequest } from '@/types/pull-request'
import type { Commit, Review } from '@/types/pull-request-details'
import { ReviewBadge } from '../components/ReviewBadge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import { Badge } from '../components/ui/badge'
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
    <header className="flex flex-col gap-2 p-6">
      <Breadcrumbs pullRequest={pullRequest} />

      <div>
        <InlineEditableTitle pullRequest={pullRequest} />
      </div>

      {pullRequest.state === 'OPEN' && (
        <div>
          {pullRequest.isDraft ? (
            <Badge className="bg-status-neutral border-status-neutral-border text-status-neutral-foreground text-[10px]">
              Draft
            </Badge>
          ) : (
            <Badge className="bg-status-success border-status-success-border text-status-success-foreground text-[10px]">
              Ready for review
            </Badge>
          )}
        </div>
      )}

      {pullRequest.state === 'CLOSED' && (
        <div>
          <Badge className="bg-status-danger border-status-danger-border text-status-danger-foreground text-[10px]">
            Closed
          </Badge>
        </div>
      )}

      {pullRequest.state === 'MERGED' && (
        <div>
          <Badge className="bg-status-merged border-status-merged-border text-status-merged-foreground text-[10px]">
            Merged
          </Badge>
        </div>
      )}

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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitCommitIcon className="size-3.5 shrink-0" />

          <span>
            {commits.length} {commits.length === 1 ? 'commit' : 'commits'}
          </span>

          {latestCommit?.message && (
            <>
              <span className="text-muted-foreground/50">·</span>

              <span className="truncate font-mono">
                {latestCommit.message.length > 80
                  ? latestCommit.message.slice(0, 80) + '…'
                  : latestCommit.message}
              </span>
            </>
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

  const handleSave = async () => {
    const trimmed = draft.trim()

    if (!trimmed || trimmed === pullRequest.title) {
      setIsEditing(false)
      return
    }

    setIsEditing(false)

    const originalPr = pullRequest

    dispatch(pullRequestsActions.upsertItem({ ...pullRequest, title: trimmed }))

    try {
      const updated = await updatePullRequest({
        owner: pullRequest.repositoryOwner,
        pullNumber: pullRequest.number,
        pullRequestId: pullRequest.id,
        repo: pullRequest.repositoryName,
        title: trimmed
      })

      dispatch(pullRequestsActions.upsertItem(updated))
    } catch (error) {
      dispatch(pullRequestsActions.upsertItem(originalPr))

      const message =
        error instanceof Error ? error.message : 'Failed to update title'

      toast.error(message)
    }
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
        className="w-full text-2xl font-semibold leading-tight text-foreground bg-transparent border-0 border-b-2 border-primary outline-none focus:ring-0 py-0.5"
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
        'font-semibold leading-tight text-foreground transition-all duration-200 ease-out text-2xl',
        !isMerged && 'cursor-text hover:opacity-80'
      )}
      onClick={handleStartEdit}
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
    <div className="flex items-center gap-1 text-muted-foreground">
      <GitPullRequest
        className={cn(
          'size-3 -mt-0.5 mr-2',
          pullRequest.state === 'MERGED' ? 'text-purple-500' : 'text-green-500'
        )}
      />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>
              <span className="text-xs">{pullRequest.repositoryOwner}</span>
            </BreadcrumbPage>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <BreadcrumbPage>
              <span className="text-xs">{pullRequest.repositoryName}</span>
            </BreadcrumbPage>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <BreadcrumbPage>
              <span className="text-xs text-muted-foreground">
                {pullRequest.number}
              </span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <button
        aria-label="Open on GitHub"
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        onClick={() => {
          window.electron.openUrl(
            `https://github.com/${pullRequest.repositoryOwner}/${pullRequest.repositoryName}/pull/${pullRequest.number}`
          )
        }}
        title="Open on GitHub"
      >
        <ExternalLinkIcon className="size-3" />
      </button>

      {pullRequest.state !== 'MERGED' && (
        <div className="ml-auto">
          <PullRequestActionsMenu pullRequest={pullRequest} />
        </div>
      )}
    </div>
  )
}
