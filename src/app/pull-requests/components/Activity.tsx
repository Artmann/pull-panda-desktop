import { memo, useCallback, useMemo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { PullRequest } from '@/types/pull-request'
import type { Comment, Commit, Review } from '@/types/pull-request-details'

import { TimeAgo } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/lib/utils'
import { useAppSelector } from '@/app/store/hooks'
import { useLandmark } from '@/app/pull-requests/PullRequestNavigationProvider'
import { useVirtualList } from '@/app/pull-requests/use-virtual-list'

import { CommentBody } from './CommentBody'
import { CommentThreadCard, FileCommentThreadCard } from './CommentThread'
import { DeploymentCard } from './DeploymentCard'
import { isVercelBot, parseVercelDeployments } from './vercel-deployments'

interface CommitPush {
  authorAvatarUrl: string | null
  authorLogin: string | null
  commits: Commit[]
}

type ActivityItem =
  | { data: Comment; id: string; timestamp: string; type: 'comment' }
  | { data: CommitPush; id: string; timestamp: string; type: 'commits' }
  | {
      data: PullRequest
      id: string
      timestamp: string
      type: 'pull_request_opened'
    }
  | { data: Review; id: string; timestamp: string; type: 'review' }

interface ActivityProps {
  pullRequest: PullRequest
}

export function Activity({ pullRequest }: ActivityProps): ReactElement {
  const comments: Comment[] = useAppSelector(
    (state) =>
      state.comments.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

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

  const sortedActivity = useMemo(
    () => buildActivityItems({ comments, commits, pullRequest, reviews }),
    [comments, commits, pullRequest, reviews]
  )

  const getItemKey = useCallback(
    (index: number) => sortedActivity[index].id,
    [sortedActivity]
  )

  const estimateSize = useCallback(() => 120, [])

  const { listRef, scrollMargin, virtualizer } = useVirtualList({
    count: sortedActivity.length,
    estimateSize,
    getItemKey,
    overscan: 6
  })

  if (sortedActivity.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No activity yet
      </div>
    )
  }

  return (
    <div
      className="w-full"
      ref={listRef}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            // Rows are offset with `top` rather than `transform` because a
            // transformed ancestor becomes the containing block for sticky
            // content inside the cards, pinning it to the row instead of the
            // scroll viewport.
            className="absolute left-0 w-full pb-3.5"
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              top: virtualItem.start - scrollMargin
            }}
          >
            <ActivityItemComponent
              allComments={comments}
              item={sortedActivity[virtualItem.index]}
              pullRequest={pullRequest}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function buildActivityItems({
  comments,
  commits,
  pullRequest,
  reviews
}: {
  comments: Comment[]
  commits: Commit[]
  pullRequest: PullRequest
  reviews: Review[]
}): ActivityItem[] {
  const topLevelComments = comments.filter(
    (comment) => !comment.parentCommentGitHubId
  )

  const seen = new Set<string>()
  const uniqueReviews = reviews.filter((review) => {
    if (seen.has(review.gitHubId)) {
      return false
    }

    seen.add(review.gitHubId)

    return true
  })

  const items: ActivityItem[] = [
    {
      data: pullRequest,
      id: pullRequest.id,
      timestamp: pullRequest.createdAt,
      type: 'pull_request_opened'
    },
    ...topLevelComments.map(
      (comment): ActivityItem => ({
        data: comment,
        id: comment.id,
        timestamp: comment.gitHubCreatedAt ?? comment.syncedAt,
        type: 'comment'
      })
    ),
    ...uniqueReviews
      .filter(
        (review) =>
          review.state !== 'COMMENTED' || (review.body ?? '').trim() !== ''
      )
      .map(
        (review): ActivityItem => ({
          data: review,
          id: review.gitHubId,
          timestamp: review.gitHubSubmittedAt ?? review.syncedAt,
          type: 'review'
        })
      ),
    // Commits from before the pull request was opened came with it; only the
    // ones added afterwards are news.
    ...commits
      .filter(
        (commit) =>
          commit.gitHubCreatedAt !== null &&
          commit.gitHubCreatedAt > pullRequest.createdAt
      )
      .map(
        (commit): ActivityItem => ({
          data: {
            authorAvatarUrl: commit.authorAvatarUrl,
            authorLogin: commit.authorLogin,
            commits: [commit]
          },
          id: `commit-${commit.id}`,
          timestamp: commit.gitHubCreatedAt ?? commit.syncedAt,
          type: 'commits'
        })
      )
  ]

  const chronological = items.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return groupConsecutiveCommits(chronological).reverse()
}

/**
 * GitHub does not say which commits arrived in the same push, so commits by
 * one author with nothing else happening in between read as a single push.
 */
function groupConsecutiveCommits(items: ActivityItem[]): ActivityItem[] {
  const grouped: ActivityItem[] = []

  for (const item of items) {
    const previous = grouped[grouped.length - 1]

    if (
      item.type === 'commits' &&
      previous?.type === 'commits' &&
      previous.data.authorLogin === item.data.authorLogin
    ) {
      grouped[grouped.length - 1] = {
        ...previous,
        data: {
          ...previous.data,
          commits: [...previous.data.commits, ...item.data.commits]
        },
        timestamp: item.timestamp
      }

      continue
    }

    grouped.push(item)
  }

  return grouped
}

interface ReviewTag {
  className: string
  label: string
}

const reviewTags: Record<string, ReviewTag | undefined> = {
  APPROVED: {
    className: 'bg-status-success text-status-success-foreground',
    label: 'Approved'
  },
  CHANGES_REQUESTED: {
    className: 'bg-status-danger text-status-danger-foreground',
    label: 'Changes requested'
  }
}

function describeItem(item: ActivityItem): {
  avatarUrl: string | null
  eventText: string
  login: string | null
  tag: ReviewTag | null
} {
  if (item.type === 'pull_request_opened') {
    return {
      avatarUrl: item.data.authorAvatarUrl,
      eventText: 'opened this pull request',
      login: item.data.authorLogin,
      tag: null
    }
  }

  if (item.type === 'commits') {
    const count = item.data.commits.length

    return {
      avatarUrl: item.data.authorAvatarUrl,
      eventText:
        count === 1 ? 'pushed 1 commit' : `pushed ${count.toString()} commits`,
      login: item.data.authorLogin,
      tag: null
    }
  }

  if (item.type === 'review') {
    const eventTexts: Record<string, string> = {
      APPROVED: 'approved these changes',
      CHANGES_REQUESTED: 'requested changes'
    }

    return {
      avatarUrl: item.data.authorAvatarUrl,
      eventText: eventTexts[item.data.state] ?? 'reviewed',
      login: item.data.authorLogin,
      tag: reviewTags[item.data.state] ?? null
    }
  }

  const isDeployment =
    isVercelBot(item.data.userLogin) &&
    parseVercelDeployments(item.data.body).length > 0

  return {
    avatarUrl: item.data.userAvatarUrl,
    eventText: isDeployment ? 'deployed a preview' : 'commented',
    login: item.data.userLogin,
    tag: null
  }
}

const ActivityItemComponent = memo(function ActivityItemComponent({
  allComments,
  item,
  pullRequest
}: {
  allComments: Comment[]
  item: ActivityItem
  pullRequest: PullRequest
}): ReactElement {
  const landmarkRef = useLandmark(`activity-${item.id}`)
  const { avatarUrl, eventText, login, tag } = useMemo(
    () => describeItem(item),
    [item]
  )
  const displayLogin = login ?? 'Someone'

  return (
    <div
      ref={landmarkRef}
      className="flex gap-3"
    >
      <Avatar className="size-6.5 shrink-0">
        <AvatarImage
          alt={displayLogin}
          src={avatarUrl ?? undefined}
        />
        <AvatarFallback className="text-2xs uppercase">
          {displayLogin.slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
          <span className="min-w-0">
            <span className="font-medium text-foreground">{displayLogin}</span>{' '}
            {eventText}
            {tag && (
              <span
                className={cn(
                  'ml-2 rounded-full px-2 py-px text-2xs',
                  tag.className
                )}
              >
                {tag.label}
              </span>
            )}
          </span>

          <TimeAgo
            className="shrink-0"
            dateTime={item.timestamp}
          />
        </div>

        <ActivityItemBody
          allComments={allComments}
          item={item}
          pullRequest={pullRequest}
        />
      </div>
    </div>
  )
})

function CommentActivityBody({
  allComments,
  comment,
  pullRequest
}: {
  allComments: Comment[]
  comment: Comment
  pullRequest: PullRequest
}): ReactElement | null {
  if (!comment.body && !comment.diffHunk && !comment.path) {
    return null
  }

  const deployments = isVercelBot(comment.userLogin)
    ? parseVercelDeployments(comment.body)
    : []

  if (deployments.length > 0) {
    return <DeploymentCard deployments={deployments} />
  }

  return (
    <div data-testid={`comment-${comment.id}`}>
      {comment.path ? (
        <FileCommentThreadCard
          allComments={allComments}
          collapseWhenOutdated={true}
          comment={comment}
          hideAuthor={true}
          pullRequest={pullRequest}
        />
      ) : (
        <CommentThreadCard
          allComments={allComments}
          comment={comment}
          hideAuthor={true}
          pullRequest={pullRequest}
        />
      )}
    </div>
  )
}

function ActivityItemBody({
  allComments,
  item,
  pullRequest
}: {
  allComments: Comment[]
  item: ActivityItem
  pullRequest: PullRequest
}): ReactElement | null {
  if (item.type === 'comment') {
    return (
      <CommentActivityBody
        allComments={allComments}
        comment={item.data}
        pullRequest={pullRequest}
      />
    )
  }

  if (item.type === 'review') {
    if (!item.data.body) {
      return null
    }

    return (
      <div data-testid={`review-${item.data.id}`}>
        <Card className="p-0 w-full gap-0">
          <CardContent className="w-full px-3.5 py-3 text-sm">
            <CommentBody content={item.data.body} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
