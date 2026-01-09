import { CheckCircle, Clock, MessageCircle } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'
import { Link, useNavigate } from 'react-router'

import { PullRequest } from '@/types/pull-request'
import { TimeAgo } from './TimeAgo'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'

export function PullRequestList({
  pullRequests
}: {
  pullRequests: PullRequest[]
}): ReactElement {
  return (
    <div className="flex flex-col gap-6 w-full">
      {pullRequests.map((pullRequest) => {
        return (
          <PullRequestCard
            key={pullRequest.id}
            pullRequest={pullRequest}
          />
        )
      })}
    </div>
  )
}

function PullRequestCard({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const navigate = useNavigate()

  const { approvalCount, changesRequestedCount, commentCount } = pullRequest

  const status = useMemo((): string => {
    // Check PR state first (Merged/Closed take priority)
    if (pullRequest.state === 'MERGED') {
      return 'Merged'
    }

    if (pullRequest.state === 'CLOSED') {
      return 'Closed'
    }

    // Then check review states for open PRs
    if (changesRequestedCount > 0) {
      return 'Changes Requested'
    }

    if (approvalCount > 0) {
      return 'Approved'
    }

    if (pullRequest.isDraft) {
      return 'Draft'
    }

    return 'Pending'
  }, [
    approvalCount,
    changesRequestedCount,
    pullRequest.isDraft,
    pullRequest.state
  ])

  const statusColorClasses = useMemo((): string => {
    if (status === 'Merged') {
      return 'bg-purple-100 text-purple-800 border-purple-200'
    }
    if (status === 'Closed') {
      return 'bg-red-100 text-red-800 border-red-200'
    }
    if (status === 'Pending') {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    if (status === 'Approved') {
      return 'bg-green-100 text-green-800 border-green-200'
    }
    if (status === 'Draft') {
      return 'bg-gray-100 text-gray-800 border-gray-200'
    }
    if (status === 'Changes Requested') {
      return 'bg-red-100 text-red-800 border-red-200'
    }

    return 'bg-gray-100 text-gray-800 border-gray-200'
  }, [status])

  const pullRequestPath = `/pull-requests/${pullRequest.id}`

  const handleClick = () => {
    navigate(pullRequestPath)
  }

  return (
    <Card
      className="cursor-pointer hover:border-gray-300"
      onClick={handleClick}
    >
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="truncate pr-2 mb-1">{pullRequest.title}</h3>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-3">
              <span>by {pullRequest.authorLogin}</span>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>
                  <TimeAgo dateTime={pullRequest.createdAt} />
                </span>
              </div>
            </div>
            {pullRequest.labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pullRequest.labels.slice(0, 3).map((label) => (
                  <Badge
                    key={label.name}
                    variant="secondary"
                    className="text-xs"
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <Badge
              variant="outline"
              className={cn(statusColorClasses, 'capitalize text-xs')}
            >
              {status.replace('-', ' ')}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div>
            <Link
              className="hover:underline flex items-center space-x-1"
              to={`${pullRequestPath}#activity`}
            >
              <MessageCircle className="h-4 w-4" />

              <span>{commentCount} comments</span>
            </Link>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4" />

            <span>{approvalCount} approvals</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
