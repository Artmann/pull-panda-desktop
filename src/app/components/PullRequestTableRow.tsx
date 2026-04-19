import { CheckCircle, MessageCircle } from 'lucide-react'
import { type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { PullRequest } from '@/types/pull-request'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { TableCell, TableRow } from './ui/table'
import { PullRequestStatusBadge } from './PullRequestStatusBadge'
import { TimeAgo } from './TimeAgo'

interface PullRequestTableRowProps {
  pullRequest: PullRequest
}

export function PullRequestTableRow({
  pullRequest
}: PullRequestTableRowProps): ReactElement {
  const navigate = useNavigate()

  const pullRequestPath = `/pull-requests/${pullRequest.id}`

  const handleClick = () => {
    navigate(pullRequestPath)
  }

  const repoSlug = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}#${pullRequest.number}`

  return (
    <TableRow
      className="cursor-pointer"
      onClick={handleClick}
    >
      <TableCell className="px-4">
        <div className="flex flex-col gap-0.5">
          <span className="truncate max-w-md font-medium">
            {pullRequest.title}
          </span>

          <span className="text-xs text-muted-foreground font-mono">
            {repoSlug}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage
              alt={pullRequest.authorLogin ?? 'Author'}
              src={pullRequest.authorAvatarUrl ?? undefined}
            />

            <AvatarFallback className="text-xs">
              {pullRequest.authorLogin?.charAt(0).toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>

          <span className="text-sm">
            {pullRequest.authorLogin ?? 'Unknown'}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <PullRequestStatusBadge pullRequest={pullRequest} />
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-3 text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="size-3" />
            <span className="text-xs">{pullRequest.commentCount}</span>
          </div>

          <div
            className={
              pullRequest.approvalCount > 0
                ? 'flex items-center gap-1 text-[var(--status-success-foreground)]'
                : 'flex items-center gap-1'
            }
          >
            <CheckCircle className="size-3" />
            <span className="text-xs">{pullRequest.approvalCount}</span>
          </div>
        </div>
      </TableCell>

      <TableCell className="text-right pr-4">
        <span className="text-xs text-muted-foreground font-mono">
          <TimeAgo dateTime={pullRequest.updatedAt} />
        </span>
      </TableCell>
    </TableRow>
  )
}
