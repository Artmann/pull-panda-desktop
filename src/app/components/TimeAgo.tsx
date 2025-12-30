import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { ReactElement } from 'react'
import invariant from 'tiny-invariant'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
import { cn } from '../lib/utils'

dayjs.extend(relativeTime)

export function TimeAgo({
  className,
  dateTime
}: {
  className?: string
  dateTime: string
}): ReactElement {
  const date = dayjs(dateTime)
  const formattedDate = date.format('MMMM D, YYYY [at] h:mm A')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          className={cn('text-xs text-muted-foreground', className)}
          dateTime={dateTime}
        >
          {formatTimestamp(dateTime)}
        </time>
      </TooltipTrigger>

      <TooltipContent>{formattedDate}</TooltipContent>
    </Tooltip>
  )
}

function formatTimestamp(timestamp: string): string {
  const date = dayjs(timestamp)
  const now = dayjs()
  const diffInSeconds = now.diff(date, 'second')

  invariant(
    diffInSeconds >= 0,
    `Timestamp ${timestamp} is in the future compared to now ${now.toISOString()}`
  )

  if (diffInSeconds < 60) {
    return 'just now'
  }

  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)

    return `${minutes.toString()}min ago`
  }

  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)

    return `${hours.toString()}h ago`
  }

  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)

    return `${days.toString()}d ago`
  }

  if (diffInSeconds < 2419200) {
    const weeks = Math.floor(diffInSeconds / 604800)

    return `${weeks.toString()}w ago`
  }

  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2419200)

    return `${months.toString()}mo ago`
  }

  const years = Math.floor(diffInSeconds / 31536000)

  return `${years.toString()}y ago`
}
