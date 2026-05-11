import { Schedule } from 'effect'

import {
  type GitHubTransportError,
  isRetryableTransport
} from './errors'

const maxRetries = 3

export const transportRetrySchedule = Schedule.exponential('1 seconds').pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(maxRetries))
)

export function shouldRetry(error: GitHubTransportError): boolean {
  return isRetryableTransport(error)
}
