let apiBaseUrl: string | null = null

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

export interface GetChecksRequest {
  owner: string
  pullNumber: number
  pullRequestId: string
  repo: string
}

export interface Check {
  id: string
  gitHubId: string
  pullRequestId: string
  name: string
  state: string | null
  conclusion: string | null
  commitSha: string | null
  suiteName: string | null
  durationInSeconds: number | null
  detailsUrl: string | null
  message: string | null
  url: string | null
  gitHubCreatedAt: string | null
  gitHubUpdatedAt: string | null
  syncedAt: string
}

export interface GetChecksResponse {
  checks: Check[]
  hasRunningChecks: boolean
}

export interface CreateCommentRequest {
  body: string
  owner: string
  pullNumber: number
  repo: string
  reviewCommentId?: number
}

export interface CreateCommentResponse {
  id: number
  success: boolean
}

export interface CreateReviewRequest {
  owner: string
  pullNumber: number
  repo: string
}

export interface CreateReviewResponse {
  authorAvatarUrl: string | null
  authorLogin: string | null
  body: string | null
  gitHubId: string
  gitHubNumericId: number
  id: string
  state: string
}

export interface SubmitReviewRequest {
  body?: string
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  owner: string
  pullNumber: number
  repo: string
  reviewId: number
}

export async function createReview(
  request: CreateReviewRequest
): Promise<CreateReviewResponse> {
  const baseUrl = await getApiBaseUrl()

  const response = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(error.error ?? 'Failed to create review')
  }

  return response.json()
}

export async function submitReview(
  request: SubmitReviewRequest
): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await fetch(
    `${baseUrl}/api/reviews/${request.reviewId}/submit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: request.body,
        event: request.event,
        owner: request.owner,
        pullNumber: request.pullNumber,
        repo: request.repo
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()

    throw new Error(error.error ?? 'Failed to submit review')
  }
}

export async function createComment(
  request: CreateCommentRequest
): Promise<CreateCommentResponse> {
  const baseUrl = await getApiBaseUrl()

  const response = await fetch(`${baseUrl}/api/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const error = await response.json()

    throw new Error(error.error ?? 'Failed to create comment')
  }

  return response.json()
}

export async function markPullRequestActive(
  pullRequestId: string
): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await fetch(
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
      message = error.error ?? message
    } catch {
      // Response wasn't JSON
    }

    throw new Error(message)
  }
}

const checksRequestTimeout = 10000

export async function getChecks(
  request: GetChecksRequest
): Promise<GetChecksResponse> {
  const baseUrl = await getApiBaseUrl()
  const params = new URLSearchParams({
    owner: request.owner,
    pullNumber: String(request.pullNumber),
    repo: request.repo
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), checksRequestTimeout)

  try {
    const response = await fetch(
      `${baseUrl}/api/checks/${request.pullRequestId}?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    )

    if (!response.ok) {
      const error = await response.json()

      throw new Error(error.error ?? 'Failed to fetch checks')
    }

    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function triggerSync(): Promise<void> {
  const baseUrl = await getApiBaseUrl()

  const response = await fetch(`${baseUrl}/api/syncs`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error('Failed to trigger sync')
  }
}
