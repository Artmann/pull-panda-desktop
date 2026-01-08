import { GitPullRequest } from 'lucide-react'
import invariant from 'tiny-invariant'

import { PullRequest } from '@/types/pullRequest'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import { PullRequestStatusBadge } from '../components/PullRequestStatusBadge'
import { ReactElement } from 'react'
import { cn } from '../lib/utils'

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

  return (
    <header className="flex flex-col gap-2 p-6">
      <Breadcrumbs pullRequest={pullRequest} />

      <div>
        <Title>{pullRequest.title}</Title>
      </div>

      <div className="flex flex-col gap-3 transition-all h-auto overflow-hidden">
        <div className="flex items-center gap-2">
          <div>
            <PullRequestStatusBadge status={pullRequest.state} />
          </div>
          {/* 
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <strong>{pullRequest.authorLogin || 'Unknown'}</strong> wants to
            merge {commits.length} commits into{' '}
            <strong>{pullRequest.baseRefName || 'main'}</strong> from{' '}
            <strong>{pullRequest.headRefName || 'unknown'}</strong>
          </div> */}
        </div>

        {/* {latestReviews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {latestReviews.map((review) => (
              <ReviewBadge
                key={review.author.login}
                review={review}
                repositoryOwner={pullRequest.repositoryOwner}
                repositoryName={pullRequest.repositoryName}
                pullRequestNumber={pullRequest.number}
              />
            ))}
          </div>
        )} */}
      </div>
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
        'font-semibold leading-tight text-gray-900 transition-all duration-200 ease-out',
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
            <BreadcrumbLink
              href={`https://github.com/${pullRequest.repositoryOwner}`}
              target="_blank"
            >
              <span className="text-xs">{pullRequest.repositoryOwner}</span>
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <BreadcrumbLink
              href={`https://github.com/${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`}
              target="_blank"
            >
              <span className="text-xs">{pullRequest.repositoryName}</span>
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <span className="inline-block text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-[2px]">
              <BreadcrumbPage>{pullRequest.number}</BreadcrumbPage>
            </span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
