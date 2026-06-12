import { OctokitError } from './errors'

export interface OctokitErrorOptions {
  // Message used when the thrown cause is not an Error. Defaults to
  // `Failed: <operation>`.
  readonly fallbackMessage?: string
  // Rewrites the resolved message (e.g. to add context). Applied to both the
  // Error message and the fallback.
  readonly transform?: (message: string) => string
}

// Pulls an HTTP status off an Octokit/transport rejection, defaulting to 500.
const statusOf = (cause: unknown): number =>
  typeof cause === 'object' &&
  cause !== null &&
  'status' in cause &&
  typeof (cause as { status: unknown }).status === 'number'
    ? (cause as { status: number }).status
    : 500

// The single place the main-process API turns an Octokit rejection into a
// tagged OctokitError. Previously copy-pasted into create-comment, reviews and
// pull-requests; now imported by all three and by the GitHubApi service.
export const octokitErrorOf =
  (operation: string, options?: OctokitErrorOptions) =>
  (cause: unknown): OctokitError => {
    const rawMessage =
      cause instanceof Error
        ? cause.message
        : (options?.fallbackMessage ?? `Failed: ${operation}`)

    const message = options?.transform
      ? options.transform(rawMessage)
      : rawMessage

    return new OctokitError({ message, operation, status: statusOf(cause) })
  }
