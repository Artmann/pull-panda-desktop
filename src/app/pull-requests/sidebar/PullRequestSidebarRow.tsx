import { EyeOffIcon } from 'lucide-react'
import { type ReactElement } from 'react'

import {
  checkRollupColors,
  checkRollupIcons,
  getCheckRollupLabel
} from '@/app/components/check-rollup'
import { Kbd, shortcutLabel } from '@/app/components/Kbd'
import { getPullRequestStatus } from '@/app/components/pull-request-status'
import { PullRequestStatusBadge } from '@/app/components/PullRequestStatusBadge'
import { formatTimestamp } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
import { cn } from '@/app/lib/utils'

import type { SidebarRow } from './sidebar-data'
import { SidebarRowContextMenu } from './SidebarRowContextMenu'

/** The dot under the check icon: attention outranks unread. */
function markerColor(needsAttention: boolean, unread: boolean): string | null {
  if (needsAttention) {
    return 'bg-status-danger-foreground'
  }

  return unread ? 'bg-primary' : null
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

  // `Pending` is what a pull request is when nothing else is true, so the pill
  // landed on most rows and told the reader nothing they had not already
  // worked out from its absence elsewhere.
  const hasStatus = getPullRequestStatus(pullRequest) !== 'Pending'

  const marker = markerColor(needsAttention, unread)

  return (
    <SidebarRowContextMenu pullRequest={pullRequest}>
      <button
        aria-current={isSelected ? 'true' : undefined}
        className={cn(
          // The list has 8px of side padding and the row 4px, so the icon
          // column starts on the same 12px line as the list caption above.
          // Both lines are a fixed 20px tall, so a row with a status pill is
          // the same height as one without.
          'grid w-full grid-cols-[1rem_1fr] gap-x-2 gap-y-1.5 text-left',
          'rounded-md px-1 py-2.5',
          'cursor-pointer transition-colors',
          'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
          isSelected ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50'
        )}
        onClick={() => onSelect(pullRequest.id)}
        type="button"
      >
        {/*
          A span rather than the trigger's own button, because this row is
          already a button and one cannot contain another.
        */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex h-5 items-center justify-center">
              <CheckIcon
                aria-label={getCheckRollupLabel(checkRollup)}
                className={cn(
                  'size-3 shrink-0',
                  checkRollupColors[checkRollup]
                )}
              />
            </span>
          </TooltipTrigger>

          <TooltipContent>{getCheckRollupLabel(checkRollup)}</TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn(
              'line-clamp-2 min-w-0 text-sm leading-5',
              unread || isSelected ? 'font-semibold' : 'font-medium',
              titleColor(isSelected, unread)
            )}
          >
            {pullRequest.title}
          </span>

          <RowTrailing
            hotkey={hotkey}
            updatedAt={pullRequest.updatedAt}
          />
        </div>

        <span className="flex h-5 items-center justify-center">
          {marker !== null && (
            <span
              aria-label={needsAttention ? 'Needs attention' : 'Unread'}
              className={cn('size-1.5 rounded-full', marker)}
              role="img"
            />
          )}
        </span>

        <div className="flex h-5 min-w-0 items-center gap-2">
          <Avatar className="size-4 shrink-0">
            <AvatarImage
              alt={pullRequest.authorLogin ?? 'Author'}
              src={pullRequest.authorAvatarUrl ?? undefined}
            />

            <AvatarFallback className="text-2xs leading-none">
              {pullRequest.authorLogin?.charAt(0).toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>

          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {slug}
          </span>

          {pullRequest.hiddenAt !== null && (
            <EyeOffIcon
              aria-label="Hidden"
              className="text-muted-foreground size-3 shrink-0"
            />
          )}

          {hasStatus && (
            <div className="shrink-0">
              <PullRequestStatusBadge
                pullRequest={pullRequest}
                size="compact"
              />
            </div>
          )}
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
          'text-muted-foreground block text-xs leading-5 tabular-nums whitespace-nowrap',
          hotkey !== undefined && 'invisible'
        )}
      >
        {formatTimestamp(updatedAt)}
      </span>

      {hotkey !== undefined && (
        <Kbd className="bg-sidebar-accent absolute top-1/2 right-0 -translate-y-1/2">
          {shortcutLabel(hotkey.toString())}
        </Kbd>
      )}
    </span>
  )
}
