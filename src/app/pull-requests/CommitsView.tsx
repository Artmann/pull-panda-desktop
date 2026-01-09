import { memo, type ReactElement } from 'react'

import { CopyToClipboardButton } from '@/app/components/CopyToClipboardButton'
import { TimeAgo } from '@/app/components/TimeAgo'
import { UserAvatar } from '@/app/components/UserAvatar'
import { formatNumber } from '@/app/lib/numbers'
import { useAppSelector } from '@/app/store/hooks'
import type { Commit } from '@/types/pullRequestDetails'
import type { PullRequest } from '@/types/pullRequest'

export const CommitsView = memo(function CommitsView({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const details = useAppSelector(
    (state) => state.pullRequestDetails[pullRequest.id]
  )
  const commits = details?.commits ?? []
  const groupedCommits = groupCommitsByDay(commits)

  if (commits.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No commits found.
      </div>
    )
  }

  return (
    <div className="pt-6">
      <div className="flex flex-col gap-6">
        {groupedCommits.map((group) => (
          <div key={group.date}>
            <h2 className="text-sm font-normal text-muted-foreground mb-4">
              {formatDateHeader(group.date)}
            </h2>

            <div className="flex flex-col gap-4">
              {group.commits.map((commit) => {
                const { title, body } = parseCommitMessage(commit.message)
                const shortHash = commit.hash.slice(0, 7)

                return (
                  <div
                    key={commit.id}
                    className="flex gap-3 rounded-md"
                  >
                    <div>
                      <UserAvatar
                        avatarUrl={commit.authorAvatarUrl}
                        login={commit.authorLogin}
                      />
                    </div>

                    <div className="flex flex-col flex-1 text-xs">
                      <div>
                        <div>
                          <h3 className="text-sm font-medium">{title}</h3>
                        </div>

                        {body && (
                          <div className="text-muted-foreground leading-relaxed mt-1">
                            {body}
                          </div>
                        )}

                        <div className="flex items-center text-muted-foreground gap-3 mt-2">
                          <div>{commit.authorLogin}</div>
                          {commit.gitHubCreatedAt && (
                            <div>
                              committed <TimeAgo dateTime={commit.gitHubCreatedAt} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
                            <div>{shortHash}</div>
                            <CopyToClipboardButton value={shortHash} />
                          </div>

                          {(commit.linesAdded !== null || commit.linesRemoved !== null) && (
                            <div className="text-xs text-muted-foreground opacity-75 flex gap-2">
                              <div className="text-green-600">
                                +{formatNumber(commit.linesAdded ?? 0)}
                              </div>{' '}
                              <div className="text-red-600">
                                -{formatNumber(commit.linesRemoved ?? 0)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

interface GroupedCommits {
  date: string
  commits: Commit[]
}

function groupCommitsByDay(commits: Commit[]): GroupedCommits[] {
  const groups: { [key: string]: Commit[] } = {}

  commits.forEach((commit) => {
    const dateString = commit.gitHubCreatedAt ?? commit.syncedAt
    const date = new Date(dateString)
    const dateKey = date.toDateString()

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(commit)
  })

  return Object.entries(groups)
    .map(([date, dateCommits]) => ({
      date,
      commits: dateCommits.sort((a, b) => {
        const dateA = a.gitHubCreatedAt ?? a.syncedAt
        const dateB = b.gitHubCreatedAt ?? b.syncedAt

        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
    }))
    .sort((a, b) => {
      const dateA = a.commits[0].gitHubCreatedAt ?? a.commits[0].syncedAt
      const dateB = b.commits[0].gitHubCreatedAt ?? b.commits[0].syncedAt

      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
}

function parseCommitMessage(message: string | null): { title: string; body: string | null } {
  if (!message) {
    return { title: 'No message', body: null }
  }

  const lines = message.split('\n')
  const title = lines[0] || 'No message'
  const bodyLines = lines.slice(1).filter((line) => line.trim() !== '')
  const body = bodyLines.length > 0 ? bodyLines.join('\n') : null

  return { title, body }
}
