// Parses the `x-ratelimit-reset` header (epoch seconds). Falls back to one
// minute from now when the header is missing.
export function parseResetSeconds(header: string | undefined): number {
  if (header) {
    return parseInt(header, 10)
  }

  return Math.floor(Date.now() / 1000) + 60
}

// Parses the `retry-after` header (seconds) into milliseconds. Falls back to
// 30 seconds when the header is missing.
export function parseRetryAfterMs(header: string | undefined): number {
  if (header) {
    return parseInt(header, 10) * 1000
  }

  return 30_000
}
