import { type ReactElement } from 'react'

import {
  checkRollupColors,
  checkRollupIcons,
  getCheckRollupLabel
} from '@/app/components/check-rollup'
import { PullRequestStatusBadge } from '@/app/components/PullRequestStatusBadge'
import { formatTimestamp } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { cn } from '@/app/lib/utils'

import type { SidebarRow } from './sidebar-data'
import { SidebarRowContextMenu } from './SidebarRowContextMenu'

interface PullRequestSidebarRowProps {
  isSelected: boolean
  onSelect: (pullRequestId: string) => void
  row: SidebarRow
}

export function PullRequestSidebarRow({
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
          needsAttention
            ? 'border-l-status-danger-foreground'
            : unread
              ? 'border-l-primary'
              : 'border-l-transparent',
          isSelected ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50'
        )}
        onClick={() => onSelect(pullRequest.id)}
        type="button"
      >
        <div className="flex w-full items-center gap-2">
          <span
            className={cn(
              'min-w-0 truncate text-[13px] leading-tight',
              unread || isSelected ? 'font-semibold' : 'font-medium',
              isSelected
                ? 'text-sidebar-accent-foreground'
                : unread
                  ? 'text-sidebar-foreground'
                  : 'text-muted-foreground'
            )}
          >
            {pullRequest.title}
          </span>

          <CheckIcon
            aria-label={getCheckRollupLabel(checkRollup)}
            className={cn('size-3 shrink-0', checkRollupColors[checkRollup])}
          />

          <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[11px] whitespace-nowrap">
            {formatTimestamp(pullRequest.updatedAt)}
          </span>
        </div>

        <div className="flex w-full items-center gap-2">
          <Avatar className="size-4 shrink-0">
            <AvatarImage
              alt={pullRequest.authorLogin ?? 'Author'}
              src={pullRequest.authorAvatarUrl ?? undefined}
            />

            <AvatarFallback className="text-[9px]">
              {pullRequest.authorLogin?.charAt(0).toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>

          <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[11px]">
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
