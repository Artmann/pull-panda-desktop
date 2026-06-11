import { Effect } from 'effect'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppEnv } from '../effect-handler'
import { reviewsRoute } from './reviews'

const operationMocks = vi.hoisted(() => ({
  createPendingReview: vi.fn(),
  deletePendingReview: vi.fn(),
  getOrSyncPendingReview: vi.fn(),
  submitReview: vi.fn()
}))

vi.mock('../operations/reviews', () => operationMocks)

// The handlers under test only run effects built from the mocked operations
// above, so they need no services — run them on the plain Effect runtime.
vi.mock('../../../sync/runtime', async () => {
  const { Effect } = await import('effect')

  return {
    getAppRuntime: () => ({
      runPromiseExit: <A, E>(effect: Effect.Effect<A, E, never>) =>
        Effect.runPromiseExit(effect)
    })
  }
})

const makeApp = () => {
  const app = new Hono<AppEnv>()

  app.use('*', async (context, next) => {
    context.set('token', 'token_123')
    await next()
  })

  app.route('/', reviewsRoute)

  return app
}

const deleteReview = (
  reviewId: string,
  query = 'owner=octocat&repo=demo&pullNumber=42'
) => makeApp().request(`/${reviewId}?${query}`, { method: 'DELETE' })

const submitReviewRequest = (reviewId: string, body: unknown) =>
  makeApp().request(`/${reviewId}/submit`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /:reviewId', () => {
  it('deletes the pending review and responds with 204', async () => {
    operationMocks.deletePendingReview.mockReturnValue(Effect.succeed(null))

    const response = await deleteReview('123')

    expect({ body: await response.text(), status: response.status }).toEqual({
      body: '',
      status: 204
    })
    expect(operationMocks.deletePendingReview).toHaveBeenCalledWith({
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo',
      reviewId: 123,
      token: 'token_123'
    })
  })

  it('rejects a non-numeric review id', async () => {
    const response = await deleteReview('abc')

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: { message: 'reviewId: Invalid review ID: abc' } },
      status: 400
    })
    expect(operationMocks.deletePendingReview).not.toHaveBeenCalled()
  })

  it('rejects a zero review id', async () => {
    const response = await deleteReview('0')

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: { message: 'reviewId: Invalid review ID: 0' } },
      status: 400
    })
    expect(operationMocks.deletePendingReview).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric pullNumber', async () => {
    const response = await deleteReview(
      '123',
      'owner=octocat&repo=demo&pullNumber=soon'
    )

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: { message: 'pullNumber: must be a number' } },
      status: 400
    })
    expect(operationMocks.deletePendingReview).not.toHaveBeenCalled()
  })
})

describe('POST /:reviewId/submit', () => {
  it('submits the review with its body and comments', async () => {
    const comments = [
      { body: 'Nit: rename this', line: 3, path: 'src/index.ts', side: 'RIGHT' }
    ]
    const result = { gitHubId: 'PRR_1', state: 'APPROVED' }

    operationMocks.submitReview.mockReturnValue(Effect.succeed(result))

    const response = await submitReviewRequest('123', {
      body: 'Looks good',
      comments,
      event: 'APPROVE',
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo'
    })

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: result,
      status: 200
    })
    expect(operationMocks.submitReview).toHaveBeenCalledWith({
      body: 'Looks good',
      comments,
      event: 'APPROVE',
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo',
      reviewId: 123,
      token: 'token_123'
    })
  })

  it('drops a non-string body and non-array comments', async () => {
    operationMocks.submitReview.mockReturnValue(
      Effect.succeed({ gitHubId: 'PRR_1', state: 'COMMENTED' })
    )

    const response = await submitReviewRequest('123', {
      body: 5,
      comments: 'not-a-list',
      event: 'COMMENT',
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo'
    })

    expect(response.status).toEqual(200)
    expect(operationMocks.submitReview).toHaveBeenCalledWith({
      body: undefined,
      comments: undefined,
      event: 'COMMENT',
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo',
      reviewId: 123,
      token: 'token_123'
    })
  })

  it('rejects an unknown event', async () => {
    const response = await submitReviewRequest('123', {
      event: 'DISMISS',
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo'
    })

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: { message: 'event: Invalid event type' } },
      status: 400
    })
    expect(operationMocks.submitReview).not.toHaveBeenCalled()
  })

  it('rejects a negative review id', async () => {
    const response = await submitReviewRequest('-1', {
      event: 'APPROVE',
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo'
    })

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: { message: 'reviewId: Invalid review ID: -1' } },
      status: 400
    })
    expect(operationMocks.submitReview).not.toHaveBeenCalled()
  })
})
