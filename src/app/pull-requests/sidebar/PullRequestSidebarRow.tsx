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
  /** Painted over the timestamp while the jump modifier is held. */
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

          {/*
            The shortcut chip is wider than the timestamp it covers, so it
            reaches back over this icon. Hiding rather than unmounting keeps
            the row's layout identical either way.
          */}
          <CheckIcon
            aria-label={getCheckRollupLabel(checkRollup)}
            className={cn(
              'size-3 shrink-0',
              checkRollupColors[checkRollup],
              hotkey !== undefined && 'invisible'
            )}
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

/**
 * The right-hand end of a row's first line. The timestamp always keeps its
 * place in the layout: while the jump modifier is held it only turns
 * invisible, and the shortcut is painted over it from out of flow. Swapping
 * the two in the layout instead would resize this column, and because the
 * title beside it is `truncate`, every row's title would reflow the moment the
 * modifier went down.
 */
function RowTrailing({
  hotkey,
  updatedAt
}: {
  hotkey?: number
  updatedAt: string
}): ReactElement {
  return (
    <span className="relative ml-auto shrink-0">
      <span
        className={cn(
          'text-muted-foreground block font-mono text-row-meta whitespace-nowrap',
          hotkey !== undefined && 'invisible'
        )}
      >
        {formatTimestamp(updatedAt)}
      </span>

      {hotkey !== undefined && (
        <span className="border-border bg-sidebar-accent text-muted-foreground absolute top-1/2 right-0 -translate-y-1/2 rounded-sm border px-1.5 py-0.5 font-mono text-row-meta leading-none whitespace-nowrap">
          {isMac() ? `⌘${hotkey.toString()}` : `Ctrl+${hotkey.toString()}`}
        </span>
      )}
    </span>
  )
}
