import dayjs from 'dayjs'
import { type ReactElement } from 'react'

import { Kbd, shortcutLabel } from '@/app/components/Kbd'
import { useAuth } from '@/app/lib/store/authContext'
import { cn } from '@/app/lib/utils'
import { useAppSelector } from '@/app/store/hooks'

export function HomePage(): ReactElement {
  const { user } = useAuth()
  const pullRequests = useAppSelector((state) => state.pullRequests.items)
  const initialized = useAppSelector((state) => state.pullRequests.initialized)

  const fullName = user?.name ?? user?.login ?? 'User'
  const displayName = fullName.split(' ')[0]

  const openPullRequests = pullRequests.filter(
    (pullRequest) => pullRequest.state === 'OPEN'
  )
  const waitingOnYou = openPullRequests.filter(
    (pullRequest) => !pullRequest.isAuthor && pullRequest.isReviewer
  ).length
  const yours = openPullRequests.filter(
    (pullRequest) => pullRequest.isAuthor
  ).length

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="flex w-full max-w-sm flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dayjs().format('dddd, MMMM D')}
        </p>

        <Greetings name={displayName} />

        <p className="mt-1 text-sm text-muted-foreground">{pickQuip()}</p>

        <div className="mt-6">
          <Summary
            initialized={initialized}
            waitingOnYou={waitingOnYou}
            yours={yours}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>{shortcutLabel('K')}</Kbd> to search everything
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>{shortcutLabel('1')}</Kbd> to open the top pull request
          </span>
        </div>
      </div>
    </div>
  )
}

interface SummaryProps {
  initialized: boolean
  waitingOnYou: number
  yours: number
}

function Summary({
  initialized,
  waitingOnYou,
  yours
}: SummaryProps): ReactElement {
  if (!initialized) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading your pull requests…
      </p>
    )
  }

  if (waitingOnYou === 0 && yours === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing open right now. Enjoy the quiet.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      <StatRow
        count={waitingOnYou}
        label={
          waitingOnYou === 1
            ? 'Review waiting on you'
            : 'Reviews waiting on you'
        }
      />
      <StatRow
        count={yours}
        label={
          yours === 1
            ? 'Pull request of yours open'
            : 'Pull requests of yours open'
        }
      />
    </div>
  )
}

interface StatRowProps {
  count: number
  label: string
}

function StatRow({ count, label }: StatRowProps): ReactElement {
  return (
    <div
      aria-label={`${count.toString()} ${label.toLowerCase()}`}
      className="flex items-center justify-between gap-4 px-4 py-3"
      role="group"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          count > 0 ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {count}
      </span>
    </div>
  )
}

const quips = [
  'Fresh bamboo, fresh diffs.',
  'May your builds be green and your conflicts few.',
  'A small pull request is a happy pull request.',
  'Every great merge starts with a single review.',
  'Pandas spend half the day eating. You can spare ten minutes for a review.',
  'Ship it, then have a snack.',
  'Nap, review, merge, repeat.'
]

function pickQuip(): string {
  // One quip per day, so it doesn't change every time you come back here.
  const day = dayjs().startOf('day').diff(dayjs(0).startOf('day'), 'day')

  return quips[day % quips.length] ?? quips[0]
}

const greetings: Record<string, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening'
}

function Greetings({ name }: { name: string }): ReactElement {
  const timeOfDay = getTimeOfDay()

  const greeting = greetings[timeOfDay] ?? greetings.morning

  return (
    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
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
