import {
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  type LucideIcon
} from 'lucide-react'
import { memo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import { TimeAgo } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { formatNumber } from '@/app/lib/numbers'
import { useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'

import { cn } from '../lib/utils'

interface StateMarker {
  className: string
  icon: LucideIcon
  label: string
}

/**
 * An open, ready pull request is the normal case and gets no marker. The
 * other states change what can be done with it, so they lead the row.
 */
function getStateMarker(pullRequest: PullRequest): StateMarker | null {
  if (pullRequest.state === 'MERGED') {
    return {
      className: 'text-status-merged-foreground',
      icon: GitMergeIcon,
      label: 'Merged'
    }
  }

  if (pullRequest.state === 'CLOSED') {
    return {
      className: 'text-status-danger-foreground',
      icon: GitPullRequestClosedIcon,
      label: 'Closed'
    }
  }

  if (pullRequest.isDraft) {
    return {
      className: 'text-muted-foreground',
      icon: GitPullRequestDraftIcon,
      label: 'Draft'
    }
  }

  return null
}

/**
 * The line under the title: who opened it and when, where it merges, and how
 * big it is. Whether it can merge lives in the status strip below.
 */
export const PullRequestMetaRow = memo(function PullRequestMetaRow({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  // Reduced inside the selector so the row re-renders on the numbers changing
  // rather than on any write to the files slice.
  const files = useAppSelector((state) => {
    const modified = state.modifiedFiles.items.filter(
      (file) => file.pullRequestId === pullRequest.id
    )

    return {
      additions: modified.reduce(
        (total, file) => total + (file.additions ?? 0),
        0
      ),
      count: modified.length,
      deletions: modified.reduce(
        (total, file) => total + (file.deletions ?? 0),
        0
      )
    }
  }, shallowEqual)

  const commitCount = useAppSelector(
    (state) =>
      state.commits.items.filter(
        (commit) => commit.pullRequestId === pullRequest.id
      ).length
  )

  const marker = getStateMarker(pullRequest)
  const author = pullRequest.authorLogin ?? 'Someone'
  const sizeParts: string[] = []

  if (commitCount > 0) {
    sizeParts.push(
      `${formatNumber(commitCount)} ${commitCount === 1 ? 'commit' : 'commits'}`
    )
  }

  if (files.count > 0) {
    sizeParts.push(
      `${formatNumber(files.count)} ${files.count === 1 ? 'file' : 'files'}`
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
      {marker && (
        <span
          className={cn(
            'flex items-center gap-1 font-medium',
            marker.className
          )}
        >
          <marker.icon
            aria-hidden
            className="size-3.5 shrink-0"
          />
          {marker.label}
        </span>
      )}

      <span className="flex items-center gap-1.5">
        <Avatar className="size-4.5">
          <AvatarImage
            alt={author}
            src={pullRequest.authorAvatarUrl ?? undefined}
          />
          <AvatarFallback className="text-2xs leading-none uppercase">
            {author.slice(0, 1)}
          </AvatarFallback>
        </Avatar>

        <span className="text-foreground">{author}</span>

        <span>
          opened <TimeAgo dateTime={pullRequest.createdAt} />
        </span>
      </span>

      {pullRequest.headRefName && (
        <span className="flex min-w-0 items-center gap-1.5 font-mono">
          <span
            className="truncate max-w-80 text-foreground/80"
            title={pullRequest.headRefName}
          >
            {pullRequest.headRefName}
          </span>

          {pullRequest.baseRefName && (
            <>
              <span aria-hidden>→</span>

              <span
                className="truncate max-w-40 text-foreground/80"
                title={`Merges into ${pullRequest.baseRefName}`}
              >
                {pullRequest.baseRefName}
              </span>
            </>
          )}
        </span>
      )}

      {files.count > 0 && (
        <span className="font-mono tabular-nums">
          <span className="text-status-success-foreground">
            +{formatNumber(files.additions)}
          </span>{' '}
          <span className="text-status-danger-foreground">
            −{formatNumber(files.deletions)}
          </span>
        </span>
      )}

      {sizeParts.length > 0 && (
        <span className="tabular-nums">{sizeParts.join(' · ')}</span>
      )}
    </div>
  )
})
