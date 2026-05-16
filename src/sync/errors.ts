import type { ParseResult } from 'effect'
import { Data } from 'effect'

export type RequestKind = 'graphql' | 'rest'

export class MissingTokenError extends Data.TaggedError('MissingTokenError')<{
  readonly message: string
}> {}

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly route: string
  readonly cause: unknown
}> {}

export class HttpError extends Data.TaggedError('HttpError')<{
  readonly route: string
  readonly status: number
  readonly message: string
}> {}

export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly route: string
  readonly resourceId: string | null
}> {}

export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly route: string
  readonly message: string
}> {}

export class PermissionError extends Data.TaggedError('PermissionError')<{
  readonly route: string
  readonly message: string
}> {}

export class PrimaryRateLimitError extends Data.TaggedError(
  'PrimaryRateLimitError'
)<{
  readonly kind: RequestKind
  readonly resetAt: number
}> {}

export class SecondaryRateLimitError extends Data.TaggedError(
  'SecondaryRateLimitError'
)<{
  readonly kind: RequestKind
  readonly retryAfterMs: number
}> {}

export class GraphQLError extends Data.TaggedError('GraphQLError')<{
  readonly query: string
  readonly errors: ReadonlyArray<{ readonly message: string }>
}> {}

export class SchemaDecodeError extends Data.TaggedError('SchemaDecodeError')<{
  readonly route: string
  readonly issue: ParseResult.ParseIssue
}> {}

export class DatabaseNotInitializedError extends Data.TaggedError(
  'DatabaseNotInitializedError'
)<{
  readonly operation: string
}> {}

export class DatabaseQueryError extends Data.TaggedError('DatabaseQueryError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

export class SyncProbeFailedError extends Data.TaggedError(
  'SyncProbeFailedError'
)<{
  readonly cause: unknown
}> {}

export class SyncHydrationFailedError extends Data.TaggedError(
  'SyncHydrationFailedError'
)<{
  readonly ids: ReadonlyArray<string>
  readonly cause: unknown
}> {}

export class SyncDetailFailedError extends Data.TaggedError(
  'SyncDetailFailedError'
)<{
  readonly operation: string
  readonly pullRequestId: string
  readonly cause: unknown
}> {}

export class SyncerNotStartedError extends Data.TaggedError(
  'SyncerNotStartedError'
)<Record<string, never>> {}

export class SyncerAlreadyRunningError extends Data.TaggedError(
  'SyncerAlreadyRunningError'
)<Record<string, never>> {}

export type GitHubTransportError =
  | NetworkError
  | HttpError
  | NotFoundError
  | ForbiddenError
  | PermissionError
  | PrimaryRateLimitError
  | SecondaryRateLimitError
  | GraphQLError
  | SchemaDecodeError
  | MissingTokenError

export type DatabaseError = DatabaseNotInitializedError | DatabaseQueryError

export type SyncError =
  | GitHubTransportError
  | DatabaseError
  | SyncProbeFailedError
  | SyncHydrationFailedError
  | SyncDetailFailedError

export function isRetryableTransport(
  error: GitHubTransportError
): error is NetworkError | PrimaryRateLimitError | SecondaryRateLimitError {
  return (
    error._tag === 'NetworkError' ||
    error._tag === 'PrimaryRateLimitError' ||
    error._tag === 'SecondaryRateLimitError'
  )
}
