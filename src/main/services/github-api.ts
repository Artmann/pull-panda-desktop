import { Octokit } from '@octokit/rest'
import { Context, Effect, Layer } from 'effect'

import { type OctokitError } from '../api/errors'
import { octokitErrorOf, type OctokitErrorOptions } from '../api/octokit-error'

// The main-process REST seam. Operations cross it instead of constructing an
// Octokit and re-implementing error mapping: `run` owns the authenticated
// client for a token and tags every rejection as an OctokitError. Distinct from
// the sync layer's GitHubRest transport (rate limiting, ETag caching) — this is
// the plain authenticated client the user-driven API operations call.
export class GitHubApi extends Context.Tag('main/GitHubApi')<
  GitHubApi,
  {
    readonly run: <Result>(
      token: string,
      operation: string,
      call: (octokit: Octokit) => Promise<Result>,
      options?: OctokitErrorOptions
    ) => Effect.Effect<Result, OctokitError>
  }
>() {}

export const GitHubApiLive: Layer.Layer<GitHubApi> = Layer.sync(
  GitHubApi,
  () => {
    const clients = new Map<string, Octokit>()

    const clientFor = (token: string): Octokit => {
      const existing = clients.get(token)

      if (existing) {
        return existing
      }

      const created = new Octokit({ auth: token })
      clients.set(token, created)

      return created
    }

    return {
      run: (token, operation, call, options) =>
        Effect.tryPromise({
          try: () => call(clientFor(token)),
          catch: octokitErrorOf(operation, options)
        })
    }
  }
)
