import { tracedFetch } from '@/app/lib/telemetry/traced-fetch'
import type { PullRequest } from '@/types/pull-request'
import type {
  CheckoutPullRequestResult,
  CloneRepoResult,
  PickFolderResult,
  VerifyRepoResult
} from '@/types/repo-checkout'

let apiBaseUrl: string | null = null

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof (payload as { message: unknown }).message === 'string' &&
    (payload as { message: string }).message.length > 0
  ) {
    return (payload as { message: string }).message
  }

  return fallback
}

async function getApiBaseUrl(): Promise<string> {
  if (apiBaseUrl) {
    return apiBaseUrl
  }

  const port = await window.electron.getApiPort()

  if (!port) {
    throw new Error('API server not available')
  }

  apiBaseUrl = `http://localhost:${port}`

  return apiBaseUrl
}

interface CreateCommentRequest {
  body: string
  owner: string
  pullNumber: number
  repo: string
  reviewCommentId?: number
}

interface CreateCommentResponse {
  id: number
  success: boolean
}

interface CreateReviewRequest {
  owner: string
  pullNumber: number
  repo: string
}

interface CreateReviewResponse {
  authorAvatarUrl: string | null
  authorLogin: string | null
  body: string | null
  gitHubId: string
  gitHubNumericId: number
  id: string
  state: string
}

interface ReviewComment {
  body: string
  line: number
  path: string
  side: 'LEFT' | 'RIGHT'
}

interface SubmitReviewRequest {
  body?: string
  comments?: ReviewComment[]
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  owner: string
  pullNumber: number
  repo: string
  reviewId: number
}

interface DeleteReviewRequest {
  owner: string
  pullNumber: number
  repo: string
  reviewId: number
}

export async function createReview(
  request: CreateReviewRequest
): Promise<CreateReviewResponse> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(extractErrorMessage(error.error, 'Failed to create review'))
  }

  return response.json()
}

export async function getPendingReview(
  request: CreateReviewRequest
): Promise<CreateReviewResponse | null> {
  const baseUrl = await getApiBaseUrl()
  const params = new URLSearchParams({
    owner: request.owner,
    pullNumber: String(request.pullNumber),
    repo: request.repo
  })

  const response = await tracedFetch(`${baseUrl}/api/reviews/pending?${params}`)

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to fetch pending review')
    )
  }

  return response.json()
}

export async function submitReview(
  request: SubmitReviewRequest
): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/reviews/${request.reviewId}/submit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: request.body,
        comments: request.comments,
        event: request.event,
        owner: request.owner,
        pullNumber: request.pullNumber,
        repo: request.repo
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(extractErrorMessage(error.error, 'Failed to submit review'))
  }
}

export async function deleteReview(
  request: DeleteReviewRequest
): Promise<void> {
  const baseUrl = await getApiBaseUrl()
  const params = new URLSearchParams({
    owner: request.owner,
    pullNumber: String(request.pullNumber),
    repo: request.repo
  })

  const response = await tracedFetch(
    `${baseUrl}/api/reviews/${request.reviewId}?${params}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(extractErrorMessage(error.error, 'Failed to delete review'))
  }
}

interface ReviewThreadResolutionRequest {
  owner: string
  pullNumber: number
  repo: string
  threadId: string
}

interface ReviewThreadResolutionResponse {
  gitHubId: string
  isResolved: boolean
  resolvedByLogin: string | null
}

export async function resolveReviewThread(
  request: ReviewThreadResolutionRequest
): Promise<ReviewThreadResolutionResponse> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/review-threads/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to resolve review thread')
    )
  }

  return response.json()
}

export async function unresolveReviewThread(
  request: ReviewThreadResolutionRequest
): Promise<ReviewThreadResolutionResponse> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/review-threads/unresolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to unresolve review thread')
    )
  }

  return response.json()
}

export async function createComment(
  request: CreateCommentRequest
): Promise<CreateCommentResponse> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to create comment')
    )
  }

  return response.json()
}

export async function markPullRequestActive(
  pullRequestId: string
): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${pullRequestId}/activate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    let message = 'Failed to mark pull request active'

    try {
      const error = await response.json()
      message = extractErrorMessage(error.error, message)
    } catch {
      // Response wasn't JSON
    }

    throw new Error(message)
  }
}

export async function setFocusedPullRequest(
  pullRequestId: string
): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${pullRequestId}/focus`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error('Failed to set focused pull request')
  }
}

export async function clearFocusedPullRequest(): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/pull-requests/focus/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to clear focused pull request')
  }
}

export async function syncPullRequestDetails(
  pullRequestId: string
): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${pullRequestId}/sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to sync pull request details')
    )
  }
}

export interface MergeRequirement {
  description: string
  key: string
  label: string
  satisfied: boolean
}

export interface MergeOptions {
  allowMergeCommit: boolean
  allowRebaseMerge: boolean
  allowSquashMerge: boolean
  mergeable: boolean | null
  mergeableState: string
  requirements: MergeRequirement[]
}

export async function getMergeOptions(
  pullRequestId: string
): Promise<MergeOptions> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${pullRequestId}/merge-options`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to fetch merge options')
    )
  }

  return response.json()
}

interface MergePullRequestRequest {
  commitMessage?: string
  commitTitle?: string
  mergeMethod: 'merge' | 'squash' | 'rebase'
  owner: string
  pullNumber: number
  pullRequestId: string
  repo: string
}

export async function mergePullRequest(
  request: MergePullRequestRequest
): Promise<PullRequest> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${request.pullRequestId}/merge`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...(request.commitMessage !== undefined && {
          commitMessage: request.commitMessage
        }),
        ...(request.commitTitle !== undefined && {
          commitTitle: request.commitTitle
        }),
        mergeMethod: request.mergeMethod,
        owner: request.owner,
        pullNumber: request.pullNumber,
        repo: request.repo
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to merge pull request')
    )
  }

  return response.json()
}

interface UpdatePullRequestBranchRequest {
  expectedHeadSha?: string
  owner: string
  pullNumber: number
  pullRequestId: string
  repo: string
}

export async function updatePullRequestBranch(
  request: UpdatePullRequestBranchRequest
): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${request.pullRequestId}/update-branch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...(request.expectedHeadSha !== undefined && {
          expectedHeadSha: request.expectedHeadSha
        }),
        owner: request.owner,
        pullNumber: request.pullNumber,
        repo: request.repo
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to update pull request branch')
    )
  }
}

interface UpdatePullRequestRequest {
  body?: string
  isDraft?: boolean
  owner: string
  pullNumber: number
  pullRequestId: string
  repo: string
  state?: 'open' | 'closed'
  title?: string
}

export async function updatePullRequest(
  request: UpdatePullRequestRequest
): Promise<PullRequest> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${request.pullRequestId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: request.body,
        isDraft: request.isDraft,
        owner: request.owner,
        pullNumber: request.pullNumber,
        repo: request.repo,
        state: request.state,
        title: request.title
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to update pull request')
    )
  }

  return response.json()
}

export async function pickRepoFolder(): Promise<PickFolderResult> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/repo-checkout/pick-folder`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error('Failed to open folder picker')
  }

  return response.json()
}

export async function verifyConnectedRepo(args: {
  fullName: string
  localPath: string
}): Promise<VerifyRepoResult> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/repo-checkout/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to verify repository')
    )
  }

  return response.json()
}

export async function cloneConnectedRepo(args: {
  fullName: string
  parentDir: string
}): Promise<CloneRepoResult> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/repo-checkout/clone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to clone repository')
    )
  }

  return response.json()
}

export async function setConnectedRepo(args: {
  fullName: string
  localPath: string
}): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/repo-checkout/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to save connected repository')
    )
  }
}

export async function checkoutPullRequestBranch(
  pullRequestId: string
): Promise<CheckoutPullRequestResult> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/repo-checkout/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pullRequestId })
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to check out branch')
    )
  }

  return response.json()
}

interface ReviewerMutationRequest {
  logins: string[]
  pullRequestId: string
}

export async function requestReviewers(
  request: ReviewerMutationRequest
): Promise<PullRequest> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${request.pullRequestId}/reviewers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logins: request.logins })
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to request reviewers')
    )
  }

  return response.json()
}

export async function removeReviewers(
  request: ReviewerMutationRequest
): Promise<PullRequest> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/pull-requests/${request.pullRequestId}/reviewers`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logins: request.logins })
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to remove reviewers')
    )
  }

  return response.json()
}

export interface Collaborator {
  avatarUrl: string
  login: string
}

export async function fetchCollaborators(args: {
  owner: string
  repo: string
}): Promise<Collaborator[]> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(
    `${baseUrl}/api/repos/${args.owner}/${args.repo}/collaborators`
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to load collaborators')
    )
  }

  const data = (await response.json()) as { collaborators: Collaborator[] }

  return data.collaborators
}

export interface CodeownerEntry {
  login: string
  patterns: string[]
}

export async function fetchCodeowners(args: {
  owner: string
  pullRequestId: string
  repo: string
}): Promise<CodeownerEntry[]> {
  const baseUrl = await getApiBaseUrl()

  const params = new URLSearchParams({ pullRequestId: args.pullRequestId })
  const response = await tracedFetch(
    `${baseUrl}/api/repos/${args.owner}/${args.repo}/codeowners?${params}`
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(
      extractErrorMessage(error.error, 'Failed to load code owners')
    )
  }

  const data = (await response.json()) as { owners: CodeownerEntry[] }

  return data.owners
}

export async function triggerSync(): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await tracedFetch(`${baseUrl}/api/syncs`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error('Failed to trigger sync')
  }
}
