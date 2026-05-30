type CheckoutErrorCode =
  | 'dirty'
  | 'fetch-failed'
  | 'not-a-repo'
  | 'not-connected'
  | 'pr-not-found'
  | 'unknown'

export interface CheckoutPullRequestResult {
  branch?: string
  code?: CheckoutErrorCode
  message?: string
  ok: boolean
  path?: string
}

export interface VerifyRepoResult {
  ok: boolean
  reason?: string
}

export interface CloneRepoResult {
  message?: string
  ok: boolean
  path?: string
}

export interface PickFolderResult {
  path: string | null
}
