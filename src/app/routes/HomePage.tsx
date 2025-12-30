import dayjs from 'dayjs'
import { type ReactElement } from 'react'

import { Badge } from '@/app/components/ui/badge'
import { useAppSelector } from '@/app/store/hooks'
import { PullRequestList } from '../components/PullRequestList'

export function HomePage(): ReactElement {
  const pullRequests = useAppSelector((state) => state.pullRequests.items)

  const openPullRequests = pullRequests.filter((pr) => pr.state === 'OPEN')
  const pullRequestThatNeedsReview = openPullRequests.filter(
    (pr) => !pr.isAuthor
  )
  const yourPullRequests = openPullRequests.filter((pr) => pr.isAuthor)

  return (
    <div className="bg-background w-full p-4 sm:p-6">
      <div className="w-full max-w-5xl mx-auto">
        <section className="mb-8">
          <div className="mb-2">
            <Greetings name="User" />
          </div>

          <div className="text-muted-foreground text-sm">
            Here's what needs your attention today
          </div>
        </section>

        {pullRequests.length === 0 ? (
          <section>
            <div className="text-center text-muted-foreground py-12">
              <p>No pull requests found.</p>
              <p className="text-sm mt-2">
                Pull requests will appear here after syncing.
              </p>
            </div>
          </section>
        ) : (
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <h2 className="text-muted-foreground">
                    Needs Your Attention
                  </h2>

                  <Badge
                    variant="outline"
                    className="text-muted-foreground border-muted-foreground/20"
                  >
                    {pullRequestThatNeedsReview.length}
                  </Badge>
                </div>

                <div>
                  <PullRequestList pullRequests={pullRequestThatNeedsReview} />
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <h2 className="text-muted-foreground">Your Pull Requests</h2>

                  <Badge
                    variant="outline"
                    className="text-muted-foreground border-muted-foreground/20"
                  >
                    {yourPullRequests.length}
                  </Badge>
                </div>

                <div>
                  <PullRequestList pullRequests={yourPullRequests} />
                </div>
              </div>
            </div>
          </section>
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
    <h1 className="md:text-xl font-medium text-gray-900 dark:text-white">
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
