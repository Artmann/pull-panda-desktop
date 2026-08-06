import { type Context, Effect } from 'effect'

import type { PullRequest } from '../../../../database/schema'
import { NotFoundError } from '../../../../sync/errors'
import type { Repository } from '../../../services/repository'

type RepositoryService = Context.Tag.Service<Repository>

export const createPullRequestFixture = (
  overrides: Partial<PullRequest> = {}
): PullRequest => ({
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
  url: 'https://github.com/octocat/demo/pull/42',
  ...overrides
})

// A Repository stub whose lookups resolve to the given pull request (or fail
// with NotFoundError when it is null). Methods a test cares about can be
// replaced via overrides; the rest die loudly when touched unexpectedly.
export const createRepositoryStub = (
  pullRequest: PullRequest | null,
  overrides: Partial<RepositoryService> = {}
): RepositoryService => {
  const requirePullRequest = () =>
    pullRequest
      ? Effect.succeed(pullRequest)
      : Effect.fail(
          new NotFoundError({
            resourceId: 'octocat/demo#42',
            route: 'repository.requirePullRequestByCoords'
          })
        )

  return {
    findCommentById: () => Effect.succeed(null),
    findPullRequestByCoords: () => Effect.succeed(pullRequest),
    findPullRequestById: () => Effect.succeed(pullRequest),
    findReviewById: () => Effect.succeed(null),
    findReviewThreadById: () => Effect.succeed(null),
    requirePullRequestByCoords: requirePullRequest,
    requirePullRequestById: requirePullRequest,
    softDeletePendingReviews: () =>
      Effect.die('softDeletePendingReviews is not used in these tests'),
    upsertReview: () => Effect.die('upsertReview is not used in these tests'),
    ...overrides
  }
}
