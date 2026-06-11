import { Effect, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PullRequest, Review } from '../../../database/schema'
import { NotFoundError } from '../../../sync/errors'
import { Database } from '../../../sync/services/database'
import { EtagStore } from '../../../sync/services/etag-store'
import { GitHubGraphQL } from '../../../sync/services/github-graphql'
import { GitHubRest } from '../../../sync/services/github-rest'
import type { UpsertReviewInput } from '../../services/repository'
import { Repository } from '../../services/repository'
import type { CreateReviewResult, OctokitReviewData } from './reviews'
import {
  createPendingReview,
  deletePendingReview,
  getOrSyncPendingReview,
  submitReview,
  toUpsertReviewInput
} from './reviews'

const mocks = vi.hoisted(() => ({
  broadcastPullRequestResourceEvents: vi.fn(),
  createReview: vi.fn(),
  deletePendingReview: vi.fn(),
  getAuthenticated: vi.fn(),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  syncPullRequestDetails: vi.fn()
}))

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    rest = {
      pulls: {
        createReview: mocks.createReview,
        deletePendingReview: mocks.deletePendingReview,
        listReviews: mocks.listReviews,
        submitReview: mocks.submitReview
      },
      users: { getAuthenticated: mocks.getAuthenticated }
    }
  }
}))

vi.mock('../../send-resource-events', () => ({
  broadcastPullRequestResourceEvents: mocks.broadcastPullRequestResourceEvents
}))

vi.mock('../../../sync/operations/sync-pull-request-details', () => ({
  syncPullRequestDetails: mocks.syncPullRequestDetails
}))

interface RepositoryState {
  upsertCalls: Array<{
    pullRequestId: string
    review: UpsertReviewInput
  }>
}

const pullRequestFixture: PullRequest = {
  assignees: null,
  authorAvatarUrl: null,
  authorLogin: 'octocat',
  body: null,
  bodyHtml: null,
  closedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  detailsSyncedAt: null,
  headRefName: 'feature',
  id: 'pr_1',
  isAssignee: false,
  isAuthor: true,
  isDraft: false,
  isReviewer: false,
  labels: null,
  mergedAt: null,
  number: 42,
  repositoryName: 'demo',
  repositoryOwner: 'octocat',
  requestedReviewers: null,
  state: 'open',
  syncedAt: '2026-01-01T00:00:00Z',
  title: 'Demo PR',
  updatedAt: '2026-01-01T00:00:00Z',
  url: 'https://github.com/octocat/demo/pull/42'
}

const persistedReviewFixture: Review = {
  authorAvatarUrl: 'https://example.com/octocat.png',
  authorLogin: 'octocat',
  body: null,
  bodyHtml: null,
  deletedAt: null,
  gitHubCreatedAt: null,
  gitHubId: 'PRR_900',
  gitHubNumericId: 900,
  gitHubSubmittedAt: null,
  id: 'rev_1',
  pullRequestId: 'pr_1',
  state: 'PENDING',
  syncedAt: '2026-06-01T00:00:00Z',
  url: null
}

const pendingReviewResponse: OctokitReviewData = {
  body: '',
  body_html: null,
  html_url: null,
  id: 900,
  node_id: 'PRR_900',
  state: 'PENDING',
  submitted_at: null,
  user: { avatar_url: 'https://example.com/octocat.png', login: 'octocat' }
}

// syncPullRequestDetails is mocked, but its real type still requires these
// services, so satisfy the type checker with stubs that die when touched.
const unusedServicesLayer = Layer.mergeAll(
  Layer.succeed(Database, {
    use: () => Effect.die('Database is not used in these tests')
  }),
  Layer.succeed(EtagStore, {
    get: () => Effect.die('EtagStore is not used in these tests'),
    remove: () => Effect.die('EtagStore is not used in these tests'),
    set: () => Effect.die('EtagStore is not used in these tests')
  }),
  Layer.succeed(GitHubGraphQL, {
    query: () => Effect.die('GitHubGraphQL is not used in these tests')
  }),
  Layer.succeed(GitHubRest, {
    request: () => Effect.die('GitHubRest is not used in these tests')
  })
)

const makeRepositoryLayer = (
  state: RepositoryState,
  pullRequest: PullRequest | null = pullRequestFixture
) => {
  const requirePullRequest = () =>
    pullRequest
      ? Effect.succeed(pullRequest)
      : Effect.fail(
          new NotFoundError({
            resourceId: 'octocat/demo#42',
            route: 'repository.requirePullRequestByCoords'
          })
        )

  return Layer.mergeAll(
    Layer.succeed(Repository, {
      findCommentById: () => Effect.succeed(null),
      findPullRequestByCoords: () => Effect.succeed(pullRequest),
      findPullRequestById: () => Effect.succeed(pullRequest),
      findReviewById: () => Effect.succeed(null),
      findReviewThreadById: () => Effect.succeed(null),
      requirePullRequestByCoords: requirePullRequest,
      requirePullRequestById: requirePullRequest,
      upsertReview: (input) =>
        Effect.sync(() => {
          state.upsertCalls.push(input)

          return persistedReviewFixture
        })
    }),
    unusedServicesLayer
  )
}

const baseInput = {
  owner: 'octocat',
  pullNumber: 42,
  repo: 'demo',
  token: 'token_123'
}

const expectedUpsertCall: {
  pullRequestId: string
  review: UpsertReviewInput
} = {
  pullRequestId: 'pr_1',
  review: {
    authorAvatarUrl: 'https://example.com/octocat.png',
    authorLogin: 'octocat',
    body: '',
    bodyHtml: null,
    gitHubCreatedAt: null,
    gitHubId: 'PRR_900',
    gitHubNumericId: 900,
    gitHubSubmittedAt: null,
    state: 'PENDING',
    url: null
  }
}

const expectedCreateReviewResult: CreateReviewResult = {
  authorAvatarUrl: 'https://example.com/octocat.png',
  authorLogin: 'octocat',
  body: null,
  gitHubId: 'PRR_900',
  gitHubNumericId: 900,
  id: 'rev_1',
  state: 'PENDING'
}

describe('reviews operations', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.broadcastPullRequestResourceEvents.mockResolvedValue(undefined)
    mocks.syncPullRequestDetails.mockReturnValue(Effect.succeed(undefined))
  })

  describe('createPendingReview', () => {
    it('creates a pending review on GitHub, persists it, and broadcasts events', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.createReview.mockResolvedValue({ data: pendingReviewResponse })

      const result = await Effect.runPromise(
        Effect.provide(
          createPendingReview(baseInput),
          makeRepositoryLayer(state)
        )
      )

      expect(mocks.createReview).toHaveBeenCalledWith({
        owner: 'octocat',
        pull_number: 42,
        repo: 'demo'
      })
      expect(state.upsertCalls).toEqual([expectedUpsertCall])
      expect(
        mocks.broadcastPullRequestResourceEvents
      ).toHaveBeenCalledWith('pr_1')
      expect(result).toEqual(expectedCreateReviewResult)
    })

    it('reuses the existing pending review when GitHub rejects a duplicate', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.createReview.mockRejectedValue(
        Object.assign(
          new Error('User can only have one pending review per pull request'),
          { status: 422 }
        )
      )
      mocks.getAuthenticated.mockResolvedValue({ data: { login: 'octocat' } })
      mocks.listReviews.mockResolvedValue({
        data: [
          { ...pendingReviewResponse, state: 'APPROVED' },
          pendingReviewResponse
        ]
      })

      const result = await Effect.runPromise(
        Effect.provide(
          createPendingReview(baseInput),
          makeRepositoryLayer(state)
        )
      )

      expect(mocks.listReviews).toHaveBeenCalledWith({
        owner: 'octocat',
        pull_number: 42,
        repo: 'demo'
      })
      expect(state.upsertCalls).toEqual([expectedUpsertCall])
      expect(result).toEqual(expectedCreateReviewResult)
    })

    it('fails with a friendly message when the duplicate review cannot be found', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.createReview.mockRejectedValue(
        Object.assign(
          new Error('User can only have one pending review per pull request'),
          { status: 422 }
        )
      )
      mocks.getAuthenticated.mockResolvedValue({ data: { login: 'octocat' } })
      mocks.listReviews.mockResolvedValue({ data: [] })

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.provide(
            createPendingReview(baseInput),
            makeRepositoryLayer(state)
          )
        )
      )

      expect({
        message: error.message,
        status: 'status' in error ? error.status : null,
        tag: error._tag
      }).toEqual({
        message: 'You already have a pending review on this pull request',
        status: 422,
        tag: 'OctokitError'
      })
      expect(state.upsertCalls).toEqual([])
    })

    it('classifies other GitHub failures as an OctokitError with their status', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.createReview.mockRejectedValue(
        Object.assign(new Error('Forbidden'), { status: 403 })
      )

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.provide(
            createPendingReview(baseInput),
            makeRepositoryLayer(state)
          )
        )
      )

      expect({
        message: error.message,
        operation: 'operation' in error ? error.operation : null,
        status: 'status' in error ? error.status : null,
        tag: error._tag
      }).toEqual({
        message: 'Forbidden',
        operation: 'pulls.createReview',
        status: 403,
        tag: 'OctokitError'
      })
      expect(mocks.listReviews).not.toHaveBeenCalled()
    })

    it('fails with NotFoundError before calling GitHub when the pull request is unknown', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.provide(
            createPendingReview(baseInput),
            makeRepositoryLayer(state, null)
          )
        )
      )

      expect(error).toEqual(
        new NotFoundError({
          resourceId: 'octocat/demo#42',
          route: 'repository.requirePullRequestByCoords'
        })
      )
      expect(mocks.createReview).not.toHaveBeenCalled()
    })
  })

  describe('getOrSyncPendingReview', () => {
    it('returns null without persisting when no pending review exists', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.getAuthenticated.mockResolvedValue({ data: { login: 'octocat' } })
      mocks.listReviews.mockResolvedValue({
        data: [
          { ...pendingReviewResponse, state: 'APPROVED' },
          {
            ...pendingReviewResponse,
            user: { avatar_url: '', login: 'someone-else' }
          }
        ]
      })

      const result = await Effect.runPromise(
        Effect.provide(
          getOrSyncPendingReview(baseInput),
          makeRepositoryLayer(state)
        )
      )

      expect(result).toEqual(null)
      expect(state.upsertCalls).toEqual([])
      expect(mocks.broadcastPullRequestResourceEvents).not.toHaveBeenCalled()
    })

    it('persists and returns the pending review owned by the current user', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.getAuthenticated.mockResolvedValue({ data: { login: 'octocat' } })
      mocks.listReviews.mockResolvedValue({ data: [pendingReviewResponse] })

      const result = await Effect.runPromise(
        Effect.provide(
          getOrSyncPendingReview(baseInput),
          makeRepositoryLayer(state)
        )
      )

      expect(state.upsertCalls).toEqual([expectedUpsertCall])
      expect(
        mocks.broadcastPullRequestResourceEvents
      ).toHaveBeenCalledWith('pr_1')
      expect(result).toEqual(expectedCreateReviewResult)
    })

    it('classifies listReviews failures as an OctokitError', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.getAuthenticated.mockResolvedValue({ data: { login: 'octocat' } })
      mocks.listReviews.mockRejectedValue(
        Object.assign(new Error('Server error'), { status: 500 })
      )

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.provide(
            getOrSyncPendingReview(baseInput),
            makeRepositoryLayer(state)
          )
        )
      )

      expect({
        message: error.message,
        operation: 'operation' in error ? error.operation : null,
        status: 'status' in error ? error.status : null,
        tag: error._tag
      }).toEqual({
        message: 'Server error',
        operation: 'pulls.listReviews (pending)',
        status: 500,
        tag: 'OctokitError'
      })
    })
  })

  describe('deletePendingReview', () => {
    it('deletes the pending review on GitHub', async () => {
      mocks.deletePendingReview.mockResolvedValue({})

      const result = await Effect.runPromise(
        deletePendingReview({ ...baseInput, reviewId: 900 })
      )

      expect(mocks.deletePendingReview).toHaveBeenCalledWith({
        owner: 'octocat',
        pull_number: 42,
        repo: 'demo',
        review_id: 900
      })
      expect(result).toEqual({ success: true })
    })

    it('classifies delete failures as an OctokitError', async () => {
      mocks.deletePendingReview.mockRejectedValue(
        Object.assign(new Error('Not Found'), { status: 404 })
      )

      const error = await Effect.runPromise(
        Effect.flip(deletePendingReview({ ...baseInput, reviewId: 900 }))
      )

      expect({
        message: error.message,
        operation: error.operation,
        status: error.status,
        tag: error._tag
      }).toEqual({
        message: 'Not Found',
        operation: 'pulls.deletePendingReview',
        status: 404,
        tag: 'OctokitError'
      })
    })
  })

  describe('submitReview', () => {
    const submitInput = {
      ...baseInput,
      body: 'Ship it',
      event: 'APPROVE' as const,
      reviewId: 900
    }

    it('submits the pending review and triggers a detail sync', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.submitReview.mockResolvedValue({})

      const result = await Effect.runPromise(
        Effect.provide(submitReview(submitInput), makeRepositoryLayer(state))
      )

      expect(mocks.submitReview).toHaveBeenCalledWith({
        body: 'Ship it',
        event: 'APPROVE',
        owner: 'octocat',
        pull_number: 42,
        repo: 'demo',
        review_id: 900
      })
      expect(result).toEqual({ success: true })

      await vi.waitFor(() => {
        expect(mocks.syncPullRequestDetails).toHaveBeenCalledWith({
          owner: 'octocat',
          pullNumber: 42,
          pullRequestId: 'pr_1',
          repositoryName: 'demo'
        })
      })
    })

    it('falls back to creating a review when the pending review is gone', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.submitReview.mockRejectedValue(
        Object.assign(new Error('Not Found'), { status: 404 })
      )
      mocks.createReview.mockResolvedValue({})

      const result = await Effect.runPromise(
        Effect.provide(
          submitReview(submitInput),
          makeRepositoryLayer(state, null)
        )
      )

      expect(mocks.createReview).toHaveBeenCalledWith({
        body: 'Ship it',
        event: 'APPROVE',
        owner: 'octocat',
        pull_number: 42,
        repo: 'demo'
      })
      expect(result).toEqual({ success: true })
    })

    it('classifies non-404 submit failures as an OctokitError', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.submitReview.mockRejectedValue(
        Object.assign(new Error('Validation Failed'), { status: 422 })
      )

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.provide(submitReview(submitInput), makeRepositoryLayer(state))
        )
      )

      expect({
        message: error.message,
        operation: 'operation' in error ? error.operation : null,
        status: 'status' in error ? error.status : null,
        tag: error._tag
      }).toEqual({
        message: 'Validation Failed',
        operation: 'pulls.submitReview',
        status: 422,
        tag: 'OctokitError'
      })
      expect(mocks.createReview).not.toHaveBeenCalled()
    })

    it('replaces the pending review when submitting with comments', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.deletePendingReview.mockRejectedValue(
        Object.assign(new Error('Not Found'), { status: 404 })
      )
      mocks.createReview.mockResolvedValue({})

      const result = await Effect.runPromise(
        Effect.provide(
          submitReview({
            ...submitInput,
            comments: [
              {
                body: 'Rename this',
                line: 12,
                path: 'src/index.ts',
                side: 'RIGHT'
              }
            ],
            event: 'REQUEST_CHANGES'
          }),
          makeRepositoryLayer(state, null)
        )
      )

      expect(mocks.deletePendingReview).toHaveBeenCalledWith({
        owner: 'octocat',
        pull_number: 42,
        repo: 'demo',
        review_id: 900
      })
      expect(mocks.createReview).toHaveBeenCalledWith({
        body: 'Ship it',
        comments: [
          { body: 'Rename this', line: 12, path: 'src/index.ts', side: 'RIGHT' }
        ],
        event: 'REQUEST_CHANGES',
        owner: 'octocat',
        pull_number: 42,
        repo: 'demo'
      })
      expect(mocks.submitReview).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('classifies non-404 delete failures when submitting with comments', async () => {
      const state: RepositoryState = { upsertCalls: [] }

      mocks.deletePendingReview.mockRejectedValue(
        Object.assign(new Error('Forbidden'), { status: 403 })
      )

      const error = await Effect.runPromise(
        Effect.flip(
          Effect.provide(
            submitReview({
              ...submitInput,
              comments: [
                {
                  body: 'Rename this',
                  line: 12,
                  path: 'src/index.ts',
                  side: 'RIGHT'
                }
              ]
            }),
            makeRepositoryLayer(state)
          )
        )
      )

      expect({
        message: error.message,
        operation: 'operation' in error ? error.operation : null,
        status: 'status' in error ? error.status : null,
        tag: error._tag
      }).toEqual({
        message: 'Forbidden',
        operation: 'pulls.createReview (with comments)',
        status: 403,
        tag: 'OctokitError'
      })
      expect(mocks.createReview).not.toHaveBeenCalled()
    })
  })

  describe('toUpsertReviewInput', () => {
    it('maps a complete review payload', () => {
      expect(
        toUpsertReviewInput({
          body: 'Looks good',
          body_html: '<p>Looks good</p>',
          html_url: 'https://github.com/octocat/demo/pull/42#review-900',
          id: 900,
          node_id: 'PRR_900',
          state: 'APPROVED',
          submitted_at: '2026-06-01T00:00:00Z',
          user: { avatar_url: 'https://example.com/a.png', login: 'octocat' }
        })
      ).toEqual({
        authorAvatarUrl: 'https://example.com/a.png',
        authorLogin: 'octocat',
        body: 'Looks good',
        bodyHtml: '<p>Looks good</p>',
        gitHubCreatedAt: '2026-06-01T00:00:00Z',
        gitHubId: 'PRR_900',
        gitHubNumericId: 900,
        gitHubSubmittedAt: '2026-06-01T00:00:00Z',
        state: 'APPROVED',
        url: 'https://github.com/octocat/demo/pull/42#review-900'
      })
    })

    it('defaults every optional field to null', () => {
      expect(
        toUpsertReviewInput({ id: 900, node_id: 'PRR_900', state: 'PENDING' })
      ).toEqual({
        authorAvatarUrl: null,
        authorLogin: null,
        body: null,
        bodyHtml: null,
        gitHubCreatedAt: null,
        gitHubId: 'PRR_900',
        gitHubNumericId: 900,
        gitHubSubmittedAt: null,
        state: 'PENDING',
        url: null
      })
    })
  })
})
