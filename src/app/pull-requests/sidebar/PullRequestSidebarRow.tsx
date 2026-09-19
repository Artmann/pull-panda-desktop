import { type ReactElement } from 'react'

import {
  checkRollupColors,
  checkRollupIcons,
  getCheckRollupLabel
} from '@/app/components/check-rollup'
import { PullRequestStatusBadge } from '@/app/components/PullRequestStatusBadge'
import { isMac } from '@/app/commands/utils'
import { formatTimestamp } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { cn } from '@/app/lib/utils'

import type { SidebarRow } from './sidebar-data'
import { SidebarRowContextMenu } from './SidebarRowContextMenu'

/** The 2px stripe down the left edge: attention outranks unread. */
function accentBorder(needsAttention: boolean, unread: boolean): string {
  if (needsAttention) {
    return 'border-l-status-danger-foreground'
  }

  return unread ? 'border-l-primary' : 'border-l-transparent'
}

function titleColor(isSelected: boolean, unread: boolean): string {
  if (isSelected) {
    return 'text-sidebar-accent-foreground'
  }

  return unread ? 'text-sidebar-foreground' : 'text-muted-foreground'
}

interface PullRequestSidebarRowProps {
  /** Shown in place of the timestamp while the jump modifier is held. */
  hotkey?: number
  isSelected: boolean
  onSelect: (pullRequestId: string) => void
  row: SidebarRow
}

export function PullRequestSidebarRow({
  hotkey,
  isSelected,
  onSelect,
  row
}: PullRequestSidebarRowProps): ReactElement {
  const { checkRollup, needsAttention, pullRequest, unread } = row

  const CheckIcon = checkRollupIcons[checkRollup]

  const slug = `${pullRequest.repositoryName} #${pullRequest.number.toString()}`

  return (
    <SidebarRowContextMenu pullRequest={pullRequest}>
      <button
        aria-current={isSelected ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col gap-2 rounded-r-md border-l-2 px-3 py-2.5 text-left',
          'cursor-pointer transition-colors',
          'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
          accentBorder(needsAttention, unread),
          isSelected ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50'
        )}
        onClick={() => onSelect(pullRequest.id)}
        type="button"
      >
        <div className="flex w-full items-center gap-2">
          <span
            className={cn(
              'min-w-0 truncate text-row-title leading-tight',
              unread || isSelected ? 'font-semibold' : 'font-medium',
              titleColor(isSelected, unread)
            )}
          >
            {pullRequest.title}
          </span>

          <CheckIcon
            aria-label={getCheckRollupLabel(checkRollup)}
            className={cn('size-3 shrink-0', checkRollupColors[checkRollup])}
          />

          <RowTrailing
            hotkey={hotkey}
            updatedAt={pullRequest.updatedAt}
          />
        </div>

        <div className="flex w-full items-center gap-2">
          <Avatar className="size-4 shrink-0">
            <AvatarImage
              alt={pullRequest.authorLogin ?? 'Author'}
              src={pullRequest.authorAvatarUrl ?? undefined}
            />

            <AvatarFallback className="text-2xs">
              {pullRequest.authorLogin?.charAt(0).toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>

          <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-row-meta">
            {slug}
          </span>

          <div className="shrink-0">
            <PullRequestStatusBadge
              pullRequest={pullRequest}
              size="compact"
            />
          </div>
        </div>
      </button>
    </SidebarRowContextMenu>
  )
}

const chipClassName =
  'border-border text-muted-foreground rounded-sm border px-1.5 py-0.5 text-row-meta uppercase'

/**
 * The right-hand end of a row's first line. While the jump modifier is held the
 * shortcut replaces the timestamp rather than sitting beside it, so nothing
 * shifts when the modifier goes down.
 */
function RowTrailing({
  hotkey,
  updatedAt
}: {
  hotkey?: number
  updatedAt: string
}): ReactElement {
  if (hotkey === undefined) {
    return (
      <span className="text-muted-foreground ml-auto shrink-0 font-mono text-row-meta whitespace-nowrap">
        {formatTimestamp(updatedAt)}
      </span>
    )
  }

  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      <span className={chipClassName}>{isMac() ? '⌘' : 'Ctrl'}</span>

      <span className={chipClassName}>{hotkey}</span>
    </span>
  )
}
