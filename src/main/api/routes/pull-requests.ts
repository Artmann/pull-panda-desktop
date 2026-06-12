import { Effect } from 'effect'
import { Hono } from 'hono'

import {
  effectHandler,
  jsonBody,
  requireNumber,
  requireString,
  type AppEnv
} from '../effect-handler'
import {
  activatePullRequest,
  addReviewers,
  clearFocusedPullRequest,
  fetchMergeOptions,
  fetchPullRequestDetails,
  mergePullRequest,
  removeReviewers,
  setFocusedPullRequest,
  syncPullRequestNow,
  updatePullRequest,
  updatePullRequestBranch
} from '../operations/pull-requests'

export const pullRequestsRoute = new Hono<AppEnv>()

pullRequestsRoute.post(
  '/focus/clear',
  effectHandler(() => clearFocusedPullRequest)
)

pullRequestsRoute.post(
  '/:pullRequestId/focus',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )

      return yield* setFocusedPullRequest(pullRequestId)
    })
  )
)

pullRequestsRoute.post(
  '/:pullRequestId/activate',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )

      return yield* activatePullRequest(pullRequestId)
    })
  )
)

pullRequestsRoute.get(
  '/:pullRequestId/details',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )

      return yield* fetchPullRequestDetails(pullRequestId)
    })
  )
)

pullRequestsRoute.patch(
  '/:pullRequestId',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )

      const raw = yield* jsonBody(context)

      const owner = yield* requireString(raw.owner, 'owner')
      const repo = yield* requireString(raw.repo, 'repo')
      const pullNumber = yield* requireNumber(raw.pullNumber, 'pullNumber')

      const title = typeof raw.title === 'string' ? raw.title : undefined
      const body = typeof raw.body === 'string' ? raw.body : undefined
      const isDraft = typeof raw.isDraft === 'boolean' ? raw.isDraft : undefined
      const state =
        raw.state === 'closed' || raw.state === 'open' ? raw.state : undefined

      const token = context.get('token')

      return yield* updatePullRequest({
        body,
        isDraft,
        owner,
        pullNumber,
        pullRequestId,
        repo,
        state,
        title,
        token
      })
    })
  )
)

pullRequestsRoute.get(
  '/:pullRequestId/merge-options',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )
      const token = context.get('token')

      return yield* fetchMergeOptions({ pullRequestId, token })
    })
  )
)

pullRequestsRoute.post(
  '/:pullRequestId/merge',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )

      const raw = yield* jsonBody(context)

      const owner = yield* requireString(raw.owner, 'owner')
      const repo = yield* requireString(raw.repo, 'repo')
      const pullNumber = yield* requireNumber(raw.pullNumber, 'pullNumber')
      const mergeMethodInput = yield* requireString(
        raw.mergeMethod,
        'mergeMethod'
      )

      const mergeMethod = mergeMethodInput as 'merge' | 'rebase' | 'squash'
      const commitTitle =
        typeof raw.commitTitle === 'string' ? raw.commitTitle : undefined
      const commitMessage =
        typeof raw.commitMessage === 'string' ? raw.commitMessage : undefined
      const token = context.get('token')

      return yield* mergePullRequest({
        commitMessage,
        commitTitle,
        mergeMethod,
        owner,
        pullNumber,
        pullRequestId,
        repo,
        token
      })
    })
  )
)

pullRequestsRoute.post(
  '/:pullRequestId/update-branch',
  effectHandler((context) =>
    Effect.gen(function* () {
      yield* requireString(context.req.param('pullRequestId'), 'pullRequestId')

      const raw = yield* jsonBody(context)

      const owner = yield* requireString(raw.owner, 'owner')
      const repo = yield* requireString(raw.repo, 'repo')
      const pullNumber = yield* requireNumber(raw.pullNumber, 'pullNumber')
      const expectedHeadSha =
        typeof raw.expectedHeadSha === 'string'
          ? raw.expectedHeadSha
          : undefined
      const token = context.get('token')

      return yield* updatePullRequestBranch({
        expectedHeadSha,
        owner,
        pullNumber,
        repo,
        token
      })
    })
  )
)

pullRequestsRoute.post(
  '/:pullRequestId/reviewers',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )
      const raw = yield* jsonBody(context)

      const logins = Array.isArray(raw.logins)
        ? raw.logins.filter(
            (entry): entry is string => typeof entry === 'string'
          )
        : []
      const token = context.get('token')

      return yield* addReviewers({ logins, pullRequestId, token })
    })
  )
)

pullRequestsRoute.delete(
  '/:pullRequestId/reviewers',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )
      const raw = yield* jsonBody(context)

      const logins = Array.isArray(raw.logins)
        ? raw.logins.filter(
            (entry): entry is string => typeof entry === 'string'
          )
        : []
      const token = context.get('token')

      return yield* removeReviewers({ logins, pullRequestId, token })
    })
  )
)

pullRequestsRoute.post(
  '/:pullRequestId/sync',
  effectHandler((context) =>
    Effect.gen(function* () {
      const pullRequestId = yield* requireString(
        context.req.param('pullRequestId'),
        'pullRequestId'
      )

      return yield* syncPullRequestNow(pullRequestId)
    })
  )
)
