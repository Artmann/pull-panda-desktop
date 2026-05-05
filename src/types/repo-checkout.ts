export type CheckoutErrorCode =
  | 'dirty'
  | 'fetch-failed'
  | 'not-a-repo'
  | 'not-connected'
  | 'pr-not-found'
  | 'unknown'

export interface CheckoutPullRequestArgs {
  pullRequestId: string
}

export interface CheckoutPullRequestResult {
  branch?: string
  code?: CheckoutErrorCode
  message?: string
  ok: boolean
  path?: string
}

export interface VerifyRepoArgs {
  fullName: string
  localPath: string
}

export interface VerifyRepoResult {
  ok: boolean
  reason?: string
}

export interface CloneRepoArgs {
  fullName: string
  parentDir: string
}

export interface CloneRepoResult {
  message?: string
  ok: boolean
  path?: string
}

export interface SetConnectedRepoArgs {
  fullName: string
  localPath: string
}

export interface PickFolderResult {
  path: string | null
}
