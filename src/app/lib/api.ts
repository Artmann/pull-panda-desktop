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
