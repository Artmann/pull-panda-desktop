import dayjs from 'dayjs'
import { type ReactElement } from 'react'

import { useAuth } from '@/app/lib/store/authContext'
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
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-primary">
          {dayjs().format('dddd, MMMM D')}
        </div>

        <Greetings name={displayName} />

        <p className="text-muted-foreground text-sm">
          {initialized
            ? summarize(waitingOnYou, yours)
            : 'Loading your pull requests…'}
        </p>

        <p className="text-muted-foreground/70 text-xs">
          Pick a pull request from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}

function summarize(waitingOnYou: number, yours: number): string {
  if (waitingOnYou === 0 && yours === 0) {
    return 'Nothing open right now. Enjoy the quiet.'
  }

  const parts: string[] = []

  if (waitingOnYou > 0) {
    parts.push(
      `${waitingOnYou.toString()} ${waitingOnYou === 1 ? 'review is' : 'reviews are'} waiting on you`
    )
  }

  if (yours > 0) {
    parts.push(
      `${yours.toString()} of your own ${yours === 1 ? 'is' : 'are'} open`
    )
  }

  return `${parts.join(' and ')}.`
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
