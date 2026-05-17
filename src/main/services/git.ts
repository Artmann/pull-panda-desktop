import { Context, Effect, Layer } from 'effect'

import {
  checkoutPullRequestBranch,
  cloneRepo,
  verifyRepo,
  type CheckoutResult,
  type CloneResult,
  type VerifyResult
} from '../git'
import { GitOperationError } from '../api/errors'

interface CheckoutInput {
  readonly headRefName: string | null
  readonly localPath: string
  readonly pullNumber: number
}

interface CloneInput {
  readonly fullName: string
  readonly parentDir: string
  readonly token?: string | null
}

interface VerifyInput {
  readonly fullName: string
  readonly localPath: string
}

export class Git extends Context.Tag('main/Git')<
  Git,
  {
    readonly checkoutPullRequestBranch: (
      input: CheckoutInput
    ) => Effect.Effect<CheckoutResult, GitOperationError>
    readonly cloneRepo: (
      input: CloneInput
    ) => Effect.Effect<CloneResult, GitOperationError>
    readonly verifyRepo: (
      input: VerifyInput
    ) => Effect.Effect<VerifyResult, GitOperationError>
  }
>() {}

const wrap = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new GitOperationError({
        operation,
        message: cause instanceof Error ? cause.message : 'Unknown error',
        cause
      })
  })

export const GitLive: Layer.Layer<Git> = Layer.succeed(Git, {
  checkoutPullRequestBranch: (input) =>
    wrap('checkoutPullRequestBranch', () => checkoutPullRequestBranch(input)),
  cloneRepo: (input) => wrap('cloneRepo', () => cloneRepo(input)),
  verifyRepo: ({ fullName, localPath }) =>
    wrap('verifyRepo', () => verifyRepo(localPath, fullName))
})
