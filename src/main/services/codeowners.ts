import { Context, Effect, Layer } from 'effect'

import {
  fetchCodeownerRules,
  matchOwners,
  type CodeownerMatch,
  type CodeownerRule
} from '../codeowners'
import { OctokitError } from '../api/errors'

export class Codeowners extends Context.Tag('main/Codeowners')<
  Codeowners,
  {
    readonly fetchRules: (input: {
      readonly owner: string
      readonly repo: string
      readonly token: string
    }) => Effect.Effect<ReadonlyArray<CodeownerRule>, OctokitError>
    readonly matchOwners: (input: {
      readonly changedPaths: ReadonlyArray<string>
      readonly rules: ReadonlyArray<CodeownerRule>
    }) => ReadonlyArray<CodeownerMatch>
  }
>() {}

export const CodeownersLive: Layer.Layer<Codeowners> = Layer.succeed(
  Codeowners,
  {
    fetchRules: ({ owner, repo, token }) =>
      Effect.tryPromise({
        try: () => fetchCodeownerRules(token, owner, repo),
        catch: (cause) => {
          const status =
            typeof cause === 'object' &&
            cause !== null &&
            'status' in cause &&
            typeof (cause as { status: unknown }).status === 'number'
              ? (cause as { status: number }).status
              : 500
          const message =
            cause instanceof Error
              ? cause.message
              : 'Failed to fetch CODEOWNERS'

          return new OctokitError({
            operation: `codeowners ${owner}/${repo}`,
            status,
            message
          })
        }
      }),
    matchOwners: ({ changedPaths, rules }) =>
      matchOwners([...rules], [...changedPaths])
  }
)
