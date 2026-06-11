import { Effect } from 'effect'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppEnv } from '../effect-handler'
import { pullRequestsRoute } from './pull-requests'

const operationMocks = vi.hoisted(() => ({
  activatePullRequest: vi.fn(),
  addReviewers: vi.fn(),
  fetchMergeOptions: vi.fn(),
  fetchPullRequestDetails: vi.fn(),
  mergePullRequest: vi.fn(),
  removeReviewers: vi.fn(),
  setFocusedPullRequest: vi.fn(),
  syncPullRequestNow: vi.fn(),
  updatePullRequest: vi.fn(),
  updatePullRequestBranch: vi.fn()
}))

vi.mock('../operations/pull-requests', async () => {
  const { Effect } = await import('effect')

  return {
    ...operationMocks,
    clearFocusedPullRequest: Effect.succeed(null)
  }
})

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

  app.route('/', pullRequestsRoute)

  return app
}

const patchPullRequest = (body: unknown) =>
  makeApp().request('/pr_1', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH'
  })

describe('PATCH /:pullRequestId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the validated fields and the token to updatePullRequest', async () => {
    const updated = { id: 'pr_1', state: 'closed' }

    operationMocks.updatePullRequest.mockReturnValue(Effect.succeed(updated))

    const response = await patchPullRequest({
      body: 'New body',
      isDraft: true,
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo',
      state: 'closed',
      title: 'New title'
    })

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: updated,
      status: 200
    })
    expect(operationMocks.updatePullRequest).toHaveBeenCalledWith({
      body: 'New body',
      isDraft: true,
      owner: 'octocat',
      pullNumber: 42,
      pullRequestId: 'pr_1',
      repo: 'demo',
      state: 'closed',
      title: 'New title',
      token: 'token_123'
    })
  })

  it('accepts the open state', async () => {
    operationMocks.updatePullRequest.mockReturnValue(
      Effect.succeed({ id: 'pr_1', state: 'open' })
    )

    const response = await patchPullRequest({
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo',
      state: 'open'
    })

    expect(response.status).toEqual(200)
    expect(operationMocks.updatePullRequest).toHaveBeenCalledWith({
      body: undefined,
      isDraft: undefined,
      owner: 'octocat',
      pullNumber: 42,
      pullRequestId: 'pr_1',
      repo: 'demo',
      state: 'open',
      title: undefined,
      token: 'token_123'
    })
  })

  it('drops optional fields with unexpected types or values', async () => {
    operationMocks.updatePullRequest.mockReturnValue(
      Effect.succeed({ id: 'pr_1' })
    )

    const response = await patchPullRequest({
      body: 7,
      isDraft: 'yes',
      owner: 'octocat',
      pullNumber: 42,
      repo: 'demo',
      state: 'merged',
      title: false
    })

    expect(response.status).toEqual(200)
    expect(operationMocks.updatePullRequest).toHaveBeenCalledWith({
      body: undefined,
      isDraft: undefined,
      owner: 'octocat',
      pullNumber: 42,
      pullRequestId: 'pr_1',
      repo: 'demo',
      state: undefined,
      title: undefined,
      token: 'token_123'
    })
  })

  it('rejects a missing owner without calling updatePullRequest', async () => {
    const response = await patchPullRequest({ pullNumber: 42, repo: 'demo' })

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: { message: 'owner: is required' } },
      status: 400
    })
    expect(operationMocks.updatePullRequest).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric pullNumber without calling updatePullRequest', async () => {
    const response = await patchPullRequest({
      owner: 'octocat',
      pullNumber: 'forty-two',
      repo: 'demo'
    })

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: { message: 'pullNumber: must be a number' } },
      status: 400
    })
    expect(operationMocks.updatePullRequest).not.toHaveBeenCalled()
  })
})
