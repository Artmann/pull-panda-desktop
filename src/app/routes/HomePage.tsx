import dayjs from 'dayjs'
import { Loader2 } from 'lucide-react'
import { type ReactElement } from 'react'

import { Badge } from '@/app/components/ui/badge'
import { useAuth } from '@/app/lib/store/authContext'
import { useTasks } from '@/app/lib/store/tasksContext'
import { useAppSelector } from '@/app/store/hooks'
import { PullRequestTable } from '../components/PullRequestTable'

export function HomePage(): ReactElement {
  const { user } = useAuth()
  const { hasSyncInProgress, tasksInitialized } = useTasks()
  const pullRequests = useAppSelector((state) => state.pullRequests.items)
  const listCount = useAppSelector((state) => state.pullRequests.listCount)
  const fullName = user?.name ?? user?.login ?? 'User'
  const displayName = fullName.split(' ')[0]

  const openPullRequests = pullRequests.filter((pr) => pr.state === 'OPEN')

  const pullRequestThatNeedsReview = openPullRequests
    .filter((pr) => !pr.isAuthor)
    .sort((a, b) => dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix())

  const yourPullRequests = openPullRequests
    .filter((pr) => pr.isAuthor)
    .sort((a, b) => dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix())

  const showEmptyStateLoading =
    pullRequests.length === 0 &&
    (!tasksInitialized || hasSyncInProgress || listCount > 0)

  return (
    <div className="bg-background w-full p-4 sm:p-6">
      <div className="w-full max-w-6xl mx-auto">
        <section className="mb-8">
          <div className="mb-2">
            <Greetings name={displayName} />
          </div>

          <div className="text-muted-foreground text-sm">
            Here's what needs your attention today
          </div>
        </section>

        {pullRequests.length === 0 ? (
          <section>
            {showEmptyStateLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-muted-foreground">
                <Loader2
                  className="h-10 w-10 shrink-0 animate-spin text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="text-foreground font-medium">
                    Syncing pull requests…
                  </p>
                  <p className="text-sm mt-2">This may take a few minutes.</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <p>No pull requests synced yet.</p>
                <p className="text-sm mt-2">
                  They'll appear here once syncing completes.
                </p>
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-8 ">
            <section>
              <div className="flex items-center space-x-2 mb-4">
                <h2 className="text-foreground font-medium">
                  Needs Your Attention
                </h2>

                <Badge
                  variant="outline"
                  className="text-muted-foreground border-border"
                >
                  {pullRequestThatNeedsReview.length}
                </Badge>
              </div>

              <PullRequestTable
                pullRequests={pullRequestThatNeedsReview}
                showActions
              />
            </section>

            <section>
              <div className="flex items-center space-x-2 mb-4">
                <h2 className="text-foreground font-medium">
                  Your Pull Requests
                </h2>

                <Badge
                  variant="outline"
                  className="text-muted-foreground border-border"
                >
                  {yourPullRequests.length}
                </Badge>
              </div>

              <PullRequestTable pullRequests={yourPullRequests} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function Greetings({ name }: { name: string }): ReactElement {
  const greetings: Record<string, string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening'
  }

  const timeOfDay = getTimeOfDay()

  const greeting = greetings[timeOfDay] ?? greetings.morning

  return (
    <h1 className="text-2xl font-semibold text-foreground">
      {greeting}, {name}
    </h1>
  )
}

function getTimeOfDay(): string {
  const hour = dayjs().hour()

  if (hour >= 12 && hour <= 18) {
    return 'afternoon'
  }

  if (hour > 18 || hour < 3) {
    return 'evening'
  }

  return 'morning'
}
