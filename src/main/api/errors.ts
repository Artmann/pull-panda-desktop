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

export function errorToHttp(error: RouteError): HttpErrorResponse {
  switch (error._tag) {
    case 'ValidationError':
      return {
        status: 400,
        body: {
          error: {
            message: error.field
              ? `${error.field}: ${error.message}`
              : error.message
          }
        }
      }

    case 'UnauthenticatedError':
    case 'MissingTokenError':
      return { status: 401, body: { error: { message: error.message } } }

    case 'ForbiddenError':
    case 'PermissionError':
      return { status: 403, body: { error: { message: error.message } } }

    case 'NotFoundError':
      return {
        status: 404,
        body: {
          error: {
            message: error.resourceId
              ? `Not found: ${error.resourceId}`
              : 'Not found'
          }
        }
      }

    case 'PrimaryRateLimitError':
    case 'SecondaryRateLimitError':
      return {
        status: 429,
        body: { error: { message: 'GitHub rate limit reached' } }
      }

    case 'OctokitError':
    case 'HttpError':
      return {
        status: error.status >= 400 && error.status < 600 ? error.status : 502,
        body: { error: { message: error.message } }
      }

    case 'NetworkError':
      return {
        status: 502,
        body: { error: { message: `Network error on ${error.route}` } }
      }

    case 'GraphQLError':
      return {
        status: 502,
        body: {
          error: {
            message: error.errors[0]?.message ?? 'GitHub GraphQL request failed'
          }
        }
      }

    case 'SchemaDecodeError':
      return {
        status: 502,
        body: {
          error: {
            message: `Unexpected response shape from GitHub on ${error.route}`
          }
        }
      }

    case 'DatabaseNotInitializedError':
      return {
        status: 503,
        body: { error: { message: 'Database not ready' } }
      }

    case 'DatabaseQueryError':
      return {
        status: 500,
        body: {
          error: { message: `Database error during ${error.operation}` }
        }
      }

    case 'GitOperationError':
      return {
        status: 500,
        body: {
          error: { message: `Git ${error.operation} failed: ${error.message}` }
        }
      }

    case 'FileSystemError':
      return {
        status: 500,
        body: {
          error: {
            message: `Filesystem ${error.operation} failed at ${error.path}`
          }
        }
      }

    case 'DeviceFlowError':
      return {
        status: error.reason === 'access_denied' ? 403 : 400,
        body: { error: { message: error.message } }
      }
  }
}
