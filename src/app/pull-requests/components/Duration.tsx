import { memo, type ReactElement } from 'react'

/**
 * Returns a formatted duration string.
 * @param timeInSeconds - The duration in seconds.
 * @returns The formatted duration string.
 *
 * For example 3670 seconds will be formatted as "1h 1m 10s".
 */
export const Duration = memo(function Duration({
  timeInSeconds
}: {
  timeInSeconds?: number
}): ReactElement | null {
  if (timeInSeconds === undefined || timeInSeconds === null) {
    return null
  }

  const hours = Math.floor(timeInSeconds / 3600)
  const minutes = Math.floor((timeInSeconds % 3600) / 60)
  const seconds = timeInSeconds % 60

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours.toString()}h`)
  }
  if (minutes > 0) {
    parts.push(`${minutes.toString()}m`)
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds.toString()}s`)
  }

  return <span>{parts.join(' ')}</span>
})
