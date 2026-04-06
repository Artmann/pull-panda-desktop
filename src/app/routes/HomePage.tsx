import dayjs from 'dayjs'
import { type ReactElement } from 'react'

import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/app/components/ui/table'
import { useAuth } from '@/app/lib/store/authContext'
import { useAppSelector } from '@/app/store/hooks'
import { PullRequestTable } from '../components/PullRequestTable'

export function HomePage(): ReactElement {
  const { user } = useAuth()
  const pullRequests = useAppSelector((state) => state.pullRequests.items)
  const initialized = useAppSelector((state) => state.pullRequests.initialized)
  const fullName = user?.name ?? user?.login ?? 'User'
  const displayName = fullName.split(' ')[0]

  const openPullRequests = pullRequests.filter((pr) => pr.state === 'OPEN')

  const pullRequestThatNeedsReview = openPullRequests
    .filter((pr) => !pr.isAuthor)
    .sort((a, b) => dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix())

  const yourPullRequests = openPullRequests
    .filter((pr) => pr.isAuthor)
    .sort((a, b) => dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix())

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

        {!initialized ? (
          <div className="space-y-8">
            <SkeletonSection title="Needs Your Attention" />
            <SkeletonSection title="Your Pull Requests" />
          </div>
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
                paramPrefix="review"
                pullRequests={pullRequestThatNeedsReview}
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

              <PullRequestTable
                paramPrefix="your"
                pullRequests={yourPullRequests}
              />
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

function SkeletonSection({ title }: { title: string }): ReactElement {
  return (
    <section>
      <div className="flex items-center space-x-2 mb-4">
        <h2 className="text-foreground font-medium">{title}</h2>

        <Skeleton className="h-5 w-5 rounded-full" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pull Request</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {Array.from({ length: 3 }, (_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </TableCell>

              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>

              <TableCell>
                <Skeleton className="h-3 w-14" />
              </TableCell>

              <TableCell>
                <Skeleton className="h-3 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
