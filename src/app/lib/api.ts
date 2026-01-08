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
