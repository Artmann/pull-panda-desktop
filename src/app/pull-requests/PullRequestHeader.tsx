import { ExternalLinkIcon, GitPullRequest } from 'lucide-react'
import { ReactElement, useMemo } from 'react'
import { shallowEqual } from 'react-redux'
import invariant from 'tiny-invariant'

import { PullRequest } from '@/types/pull-request'
import type { Review } from '@/types/pull-request-details'
import { ReviewBadge } from '../components/ReviewBadge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import { cn } from '../lib/utils'
import { useAppSelector } from '../store/hooks'
import { getLatestReviews } from './get-latest-reviews'

export function StickyPullRequestHeader({
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
        transition-all
      `}
      style={{
        display: transitionProgress === 0 ? 'none' : 'flex',
        filter: transitionProgress < 1 ? `blur(12px)` : undefined,
        opacity: transitionProgress,
        pointerEvents: transitionProgress === 1 ? 'auto' : 'none'
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
}

export function PullRequestHeader({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  invariant(pullRequest, 'PullRequestHeader requires a pull request')

  const reviews: Review[] = useAppSelector(
    (state) =>
      state.reviews.items.filter((r) => r.pullRequestId === pullRequest.id),
    shallowEqual
  )

  const latestReviews = useMemo(() => getLatestReviews(reviews), [reviews])

  return (
    <header className="flex flex-col gap-2 p-6">
      <Breadcrumbs pullRequest={pullRequest} />

      <div>
        <Title>{pullRequest.title}</Title>
      </div>

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
    </header>
  )
}

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
        'font-semibold leading-tight text-gray-900 dark:text-gray-100 transition-all duration-200 ease-out',
        size === 'sm' ? 'text-xl' : 'text-2xl'
      )}
    >
      {children}
    </h1>
  )
}

function Breadcrumbs({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  return (
    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
      <GitPullRequest className="size-3 -mt-0.5 mr-2 text-green-500" />

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
        className="ml-3 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        onClick={() => {
          window.electron.openUrl(
            `https://github.com/${pullRequest.repositoryOwner}/${pullRequest.repositoryName}/pull/${pullRequest.number}`
          )
        }}
        title="Open on GitHub"
      >
        <ExternalLinkIcon className="size-3" />
      </button>
    </div>
  )
}
