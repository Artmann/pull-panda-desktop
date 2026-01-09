import { SquaresUnite } from 'lucide-react'
import { memo, type ReactElement } from 'react'

import {
  GitHubLogoIcon,
  JiraLogoIcon,
  LinearLogoIcon
} from '@/app/components/icons'

export const IssueCard = memo(function IssueCard({
  issue
}: {
  issue: {
    source?: 'github' | 'jira' | 'linear'
    title?: string
    url: string
  }
}): ReactElement {
  return (
    <a
      className={`
        flex items-center gap-4
        rounded-sm border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800
        px-4 py-3
        w-full max-w-2xl
      `}
      href={issue.url}
      rel="noreferrer noopener"
      target="_blank"
    >
      <div className="size-6 text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100">
        {issue.source === 'linear' ? (
          <LinearLogoIcon className="size-full" />
        ) : issue.source === 'jira' ? (
          <JiraLogoIcon className="size-full" />
        ) : issue.source === 'github' ? (
          <GitHubLogoIcon className="size-full" />
        ) : (
          <SquaresUnite className="size-full" />
        )}
      </div>

      <div className="flex-1 min-w-0 text-xs">
        {issue.title && (
          <div className="font-semibold truncate">{issue.title}</div>
        )}
        <div className="truncate text-muted-foreground">{issue.url}</div>
      </div>
    </a>
  )
})
