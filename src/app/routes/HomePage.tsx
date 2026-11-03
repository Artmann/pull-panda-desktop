import dayjs from 'dayjs'
import { type ReactElement } from 'react'

import { Kbd, shortcutLabel } from '@/app/components/Kbd'
import { PandaMark } from '@/app/components/PandaMark'
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
    <div className="relative h-full w-full overflow-hidden">
      <Glow />

      <div className="relative flex h-full w-full items-center justify-center p-8">
        <div className="flex max-w-lg flex-col items-center text-center">
          <div className="relative mb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-500">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl" />
            <div className="relative flex size-24 items-center justify-center rounded-full border border-border bg-card shadow-lg">
              <PandaMark
                className="motion-safe:animate-float"
                size={52}
              />
            </div>
          </div>

          <div className="mb-3 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-primary motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:delay-100 motion-safe:duration-500 motion-safe:fill-mode-both">
            {dayjs().format('dddd, MMMM D')}
          </div>

          <Greetings name={displayName} />

          <p className="mt-2 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:delay-300 motion-safe:duration-500 motion-safe:fill-mode-both">
            {pickQuip()}
          </p>

          <div className="mt-8 w-full motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-500 motion-safe:duration-500 motion-safe:fill-mode-both">
            <Summary
              initialized={initialized}
              waitingOnYou={waitingOnYou}
              yours={yours}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:delay-700 motion-safe:duration-500 motion-safe:fill-mode-both">
            <span className="flex items-center gap-1.5">
              <Kbd>{shortcutLabel('K')}</Kbd> to search everything
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>{shortcutLabel('1')}</Kbd> to open the top pull request
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Glow(): ReactElement {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
    >
      <div className="absolute -top-1/4 left-1/4 size-[28rem] rounded-full bg-primary/20 blur-3xl motion-safe:animate-drift" />
      <div className="absolute top-1/3 -right-24 size-[24rem] rounded-full bg-chart-1/15 blur-3xl motion-safe:animate-drift motion-safe:[animation-delay:-6s]" />
      <div className="absolute -bottom-1/4 -left-16 size-[26rem] rounded-full bg-chart-4/15 blur-3xl motion-safe:animate-drift motion-safe:[animation-delay:-12s]" />
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
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        className={
          waitingOnYou > 0
            ? 'border-status-warning-border bg-status-warning text-status-warning-foreground'
            : 'border-status-success-border bg-status-success text-status-success-foreground'
        }
        count={waitingOnYou}
        label={
          waitingOnYou === 1
            ? 'Review waiting on you'
            : 'Reviews waiting on you'
        }
      />
      <StatCard
        className="border-status-merged-border bg-status-merged text-status-merged-foreground"
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

interface StatCardProps {
  className: string
  count: number
  label: string
}

function StatCard({ className, count, label }: StatCardProps): ReactElement {
  return (
    <div
      aria-label={`${count.toString()} ${label.toLowerCase()}`}
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border px-4 py-4 shadow-sm',
        className
      )}
      role="group"
    >
      <span className="text-4xl font-bold tabular-nums tracking-tight">
        {count}
      </span>
      <span className="text-xs font-medium">{label}</span>
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
    <h1 className="text-4xl font-bold tracking-tight text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:delay-200 motion-safe:duration-500 motion-safe:fill-mode-both">
      {greeting},{' '}
      <span className="bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-transparent">
        {name}
      </span>
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
