import { Duration, Effect } from 'effect'

import { type GitHubTransportError } from './errors'

const maxNetworkRetries = 3
const networkBaseDelayMs = 1000
const networkMaxDelayMs = 30_000
const rateLimitSafetyBufferMs = 1000

function networkBackoffDelay(attempt: number): number {
  const exponential = networkBaseDelayMs * Math.pow(2, attempt)
  const jitter = 0.5 + Math.random() * 0.5

  return Math.min(networkMaxDelayMs, Math.round(exponential * jitter))
}

function primaryRateLimitDelay(resetAtSeconds: number): number {
  const remainingMs = resetAtSeconds * 1000 - Date.now()

  return Math.max(
    rateLimitSafetyBufferMs,
    remainingMs + rateLimitSafetyBufferMs
  )
}

export function retryTransport<A, R>(
  effect: Effect.Effect<A, GitHubTransportError, R>
): Effect.Effect<A, GitHubTransportError, R> {
  const attempt = (
    networkAttempts: number
  ): Effect.Effect<A, GitHubTransportError, R> =>
    effect.pipe(
      Effect.catchTag('PrimaryRateLimitError', (error) => {
        const waitMs = primaryRateLimitDelay(error.resetAt)

        return Effect.logInfo(
          `[Retry] ${error.kind} primary rate limit hit, waiting ${Math.ceil(
            waitMs / 1000
          )}s for reset.`
        ).pipe(
          Effect.flatMap(() => Effect.sleep(Duration.millis(waitMs))),
          Effect.flatMap(() => attempt(networkAttempts))
        )
      }),
      Effect.catchTag('SecondaryRateLimitError', (error) => {
        const waitMs = error.retryAfterMs + rateLimitSafetyBufferMs

        return Effect.logInfo(
          `[Retry] ${error.kind} secondary rate limit, waiting ${Math.ceil(
            waitMs / 1000
          )}s.`
        ).pipe(
          Effect.flatMap(() => Effect.sleep(Duration.millis(waitMs))),
          Effect.flatMap(() => attempt(networkAttempts))
        )
      }),
      Effect.catchTag('NetworkError', (error) => {
        if (networkAttempts >= maxNetworkRetries) {
          return Effect.fail(error as GitHubTransportError)
        }

        const waitMs = networkBackoffDelay(networkAttempts)

        return Effect.sleep(Duration.millis(waitMs)).pipe(
          Effect.flatMap(() => attempt(networkAttempts + 1))
        )
      })
    )

  return attempt(0)
}
