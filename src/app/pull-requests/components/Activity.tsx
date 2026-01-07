import {
  CheckCircle,
  Eye,
  GitPullRequest,
  MessageSquare,
  MessageSquareIcon,
  XCircle
} from 'lucide-react'
import { memo, useMemo, type ReactElement } from 'react'

import type { PullRequest } from '@/types/pullRequest'
import type { Comment, Review } from '@/types/pullRequestDetails'

import { TimeAgo } from '@/app/components/TimeAgo'
import { UserAvatar } from '@/app/components/UserAvatar'
import { Card, CardContent } from '@/app/components/ui/card'

import { CommentBody } from './CommentBody'

interface ActivityItem {
  id: string
  type: 'pull_request_opened' | 'comment' | 'review'
  timestamp: string
  data: PullRequest | Comment | Review
}

interface ActivityProps {
  comments: Comment[]
  pullRequest: PullRequest
  reviews: Review[]
}

export function Activity({
  comments,
  pullRequest,
  reviews
}: ActivityProps): ReactElement {
  const topLevelComments = comments.filter(
    (comment) => !comment.parentCommentGitHubId
  )

  const uniqueReviews = reviews.filter(
    (review, index, arr) =>
      arr.findIndex((r) => r.gitHubId === review.gitHubId) === index
  )

  const activityItems: ActivityItem[] = [
    {
      id: pullRequest.id,
      type: 'pull_request_opened',
      timestamp: pullRequest.createdAt,
      data: pullRequest
    },
    ...topLevelComments.map((comment) => ({
      id: comment.id,
      type: 'comment' as const,
      timestamp: comment.gitHubCreatedAt ?? comment.syncedAt,
      data: comment
    })),
    ...uniqueReviews.map((review) => ({
      id: review.gitHubId,
      type: 'review' as const,
      timestamp: review.gitHubSubmittedAt ?? review.syncedAt,
      data: review
    }))
  ]

  const filteredActivityItems = activityItems.filter((item) => {
    if (isReview(item)) {
      if (item.data.state === 'COMMENTED' && (item.data.body ?? '').trim() === '') {
        return false
      }
    }

    return true
  })

  const sortedActivity = filteredActivityItems.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="flex flex-col gap-10 pt-4 w-full">
      {sortedActivity.map((item) => (
        <ActivityItemComponent
          key={item.id}
          item={item}
          pullRequest={pullRequest}
        />
      ))}

      {sortedActivity.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No activity yet
        </div>
      )}
    </div>
  )
}

const ActivityItemComponent = memo(function ActivityItemComponent({
  item,
  pullRequest
}: {
  item: ActivityItem
  pullRequest: PullRequest
}): ReactElement {
  const icon = useMemo(() => {
    if (isPullRequestOpened(item)) {
      return <GitPullRequest className="size-3 text-green-500" />
    }

    if (isComment(item)) {
      return <MessageSquareIcon className="size-3 text-blue-500" />
    }

    if (isReview(item)) {
      const review = item.data

      if (review.state.toLowerCase() === 'approved') {
        return <CheckCircle className="size-3 text-green-500" />
      }

      if (review.state.toLowerCase() === 'changes_requested') {
        return <XCircle className="size-3 text-red-500" />
      }

      if (review.state.toLowerCase() === 'commented') {
        return <MessageSquare className="size-3 text-blue-500" />
      }

      return <Eye className="size-3 text-gray-500" />
    }

    return <Eye className="size-3 text-gray-500" />
  }, [item])

  const eventText = useMemo(() => {
    if (isComment(item)) {
      return 'commented'
    }

    if (isReview(item)) {
      if (item.data.state === 'APPROVED') {
        return 'approved the changes'
      }

      if (item.data.state === 'CHANGES_REQUESTED') {
        return 'requested changes'
      }

      if (item.data.state === 'COMMENTED') {
        return 'commented'
      }
    }

    if (isPullRequestOpened(item)) {
      return 'opened this pull request'
    }

    return null
  }, [item])

  const user = useMemo(() => {
    if (isPullRequestOpened(item)) {
      return {
        avatarUrl: item.data.authorAvatarUrl,
        login: item.data.authorLogin
      }
    }

    if (isComment(item)) {
      return {
        avatarUrl: item.data.userAvatarUrl,
        login: item.data.userLogin
      }
    }

    if (isReview(item)) {
      return {
        avatarUrl: item.data.authorAvatarUrl,
        login: item.data.authorLogin
      }
    }

    return { avatarUrl: null, login: null }
  }, [item])

  return (
    <div
      className="flex gap-6"
      key={item.id}
    >
      <div>
        <div className="flex-shrink-0 mt-[1px] p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-border">
          {icon}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-4 text-xs">
          <div className="flex items-center gap-4">
            <UserAvatar
              avatarUrl={user.avatarUrl}
              login={user.login}
            />

            <div>
              <span className="font-medium">{user.login}</span>{' '}
              <span className="text-muted-foreground">{eventText}</span>
            </div>
          </div>

          <div className="text-muted-foreground text-xs ml-auto">
            <TimeAgo dateTime={item.timestamp} />
          </div>
        </div>

        <ActivityItemBody
          key={`${item.type}-${item.id}`}
          item={item}
          pullRequest={pullRequest}
        />
      </div>
    </div>
  )
})

function ActivityItemBody({
  item
}: {
  item: ActivityItem
  pullRequest: PullRequest
}): ReactElement | null {
  if (isComment(item)) {
    const comment = item.data

    if (!comment.body) {
      return null
    }

    return (
      <div className="py-4">
        <Card className="p-0 w-full gap-0">
          <CardContent className="w-full p-4 text-xs">
            <CommentBody
              content={comment.body}
              path={comment.path ?? undefined}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isReview(item)) {
    if (!item.data.body) {
      return null
    }

    return (
      <div className="py-4">
        <Card className="p-0 w-full gap-0">
          <CardContent className="w-full p-4 text-xs">
            <CommentBody content={item.data.body} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

function isComment(
  item: ActivityItem
): item is ActivityItem & { type: 'comment'; data: Comment } {
  return item.type === 'comment'
}

function isPullRequestOpened(item: ActivityItem): item is ActivityItem & {
  type: 'pull_request_opened'
  data: PullRequest
} {
  return item.type === 'pull_request_opened'
}

function isReview(
  item: ActivityItem
): item is ActivityItem & { type: 'review'; data: Review } {
  return item.type === 'review'
}
