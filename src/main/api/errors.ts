import { Data } from 'effect'

import type {
  DatabaseNotInitializedError,
  DatabaseQueryError,
  ForbiddenError,
  GraphQLError,
  HttpError,
  MissingTokenError,
  NetworkError,
  NotFoundError,
  PermissionError,
  PrimaryRateLimitError,
  SchemaDecodeError,
  SecondaryRateLimitError
} from '../../sync/errors'

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string
  readonly field?: string
}> {}

export class UnauthenticatedError extends Data.TaggedError(
  'UnauthenticatedError'
)<{
  readonly message: string
}> {}

export class OctokitError extends Data.TaggedError('OctokitError')<{
  readonly operation: string
  readonly status: number
  readonly message: string
}> {}

export class GitOperationError extends Data.TaggedError('GitOperationError')<{
  readonly operation: string
  readonly message: string
  readonly cause: unknown
}> {}

export class FileSystemError extends Data.TaggedError('FileSystemError')<{
  readonly operation: string
  readonly path: string
  readonly cause: unknown
}> {}

export class DeviceFlowError extends Data.TaggedError('DeviceFlowError')<{
  readonly reason:
    | 'access_denied'
    | 'expired_token'
    | 'request_failed'
    | 'unknown'
  readonly message: string
}> {}

export type ApiError =
  | DeviceFlowError
  | FileSystemError
  | GitOperationError
  | OctokitError
  | UnauthenticatedError
  | ValidationError

export type RouteError =
  | ApiError
  | DatabaseNotInitializedError
  | DatabaseQueryError
  | ForbiddenError
  | GraphQLError
  | HttpError
  | MissingTokenError
  | NetworkError
  | NotFoundError
  | PermissionError
  | PrimaryRateLimitError
  | SchemaDecodeError
  | SecondaryRateLimitError

export interface HttpErrorResponse {
  readonly body: { readonly error: { readonly message: string } }
  readonly status: number
}

const respond = (status: number, message: string): HttpErrorResponse => ({
  body: { error: { message } },
  status
})

type ErrorHandlers = {
  [K in RouteError['_tag']]: (
    error: Extract<RouteError, { _tag: K }>
  ) => HttpErrorResponse
}

const errorHandlers: ErrorHandlers = {
  DatabaseNotInitializedError: () => respond(503, 'Database not ready'),
  DatabaseQueryError: (error) =>
    respond(500, `Database error during ${error.operation}`),
  DeviceFlowError: (error) =>
    respond(error.reason === 'access_denied' ? 403 : 400, error.message),
  FileSystemError: (error) =>
    respond(500, `Filesystem ${error.operation} failed at ${error.path}`),
  ForbiddenError: (error) => respond(403, error.message),
  GitOperationError: (error) =>
    respond(500, `Git ${error.operation} failed: ${error.message}`),
  GraphQLError: (error) =>
    respond(502, error.errors[0]?.message ?? 'GitHub GraphQL request failed'),
  HttpError: (error) =>
    respond(
      error.status >= 400 && error.status < 600 ? error.status : 502,
      error.message
    ),
  MissingTokenError: (error) => respond(401, error.message),
  NetworkError: (error) => respond(502, `Network error on ${error.route}`),
  NotFoundError: (error) =>
    respond(
      404,
      error.resourceId ? `Not found: ${error.resourceId}` : 'Not found'
    ),
  OctokitError: (error) =>
    respond(
      error.status >= 400 && error.status < 600 ? error.status : 502,
      error.message
    ),
  PermissionError: (error) => respond(403, error.message),
  PrimaryRateLimitError: () => respond(429, 'GitHub rate limit reached'),
  SchemaDecodeError: (error) =>
    respond(502, `Unexpected response shape from GitHub on ${error.route}`),
  SecondaryRateLimitError: () => respond(429, 'GitHub rate limit reached'),
  UnauthenticatedError: (error) => respond(401, error.message),
  ValidationError: (error) =>
    respond(
      400,
      error.field ? `${error.field}: ${error.message}` : error.message
    )
}

export function errorToHttp(error: RouteError): HttpErrorResponse {
  const handler = errorHandlers[error._tag] as (
    error: RouteError
  ) => HttpErrorResponse

  return handler(error)
}
