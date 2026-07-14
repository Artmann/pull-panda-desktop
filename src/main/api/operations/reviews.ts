import { Octokit } from '@octokit/rest'
import { Effect } from 'effect'

import { syncPullRequestDetails } from '../../../sync/operations/sync-pull-request-details'
import { Repository } from '../../services/repository'
import { broadcastPullRequestResourceEvents } from '../../send-resource-events'
import { octokitErrorOf } from '../octokit-error'

export interface CreateReviewInput {
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly token: string
}

export interface CreateReviewResult {
  readonly authorAvatarUrl: string | null
  readonly authorLogin: string | null
  readonly body: string | null
  readonly gitHubId: string
  readonly gitHubNumericId: number
  readonly id: string
  readonly state: string
}

export interface GetPendingReviewInput {
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly token: string
}

export interface DeleteReviewInput {
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly reviewId: number
  readonly token: string
}

export interface SubmitReviewComment {
  readonly body: string
  readonly line: number
  readonly path: string
  readonly side: 'LEFT' | 'RIGHT'
}

export interface SubmitReviewInput {
  readonly body?: string
  readonly comments?: ReadonlyArray<SubmitReviewComment>
  readonly event: 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES'
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly reviewId: number
  readonly token: string
}

export type OctokitReviewData = {
  body?: string | null
  body_html?: string | null
  html_url?: string | null
  id: number
  node_id: string
  state: string
  submitted_at?: string | null
  user?: { avatar_url?: string; login?: string } | null
}

export const toUpsertReviewInput = (data: OctokitReviewData) => ({
  authorAvatarUrl: data.user?.avatar_url ?? null,
  authorLogin: data.user?.login ?? null,
  body: data.body ?? null,
  bodyHtml: data.body_html ?? null,
  gitHubCreatedAt: data.submitted_at ?? null,
  gitHubId: data.node_id,
  gitHubNumericId: data.id,
  gitHubSubmittedAt: data.submitted_at ?? null,
  state: data.state,
  url: data.html_url ?? null
})

const toCreateReviewResult = (
  persisted: {
    authorAvatarUrl: string | null
    authorLogin: string | null
    body: string | null
    gitHubId: string
    gitHubNumericId: number | null
    id: string
    state: string
  },
  fallbackNumericId: number
): CreateReviewResult => ({
  authorAvatarUrl: persisted.authorAvatarUrl,
  authorLogin: persisted.authorLogin,
  body: persisted.body,
  gitHubId: persisted.gitHubId,
  gitHubNumericId: persisted.gitHubNumericId ?? fallbackNumericId,
  id: persisted.id,
  state: persisted.state
})

const findPendingReviewForCurrentUser = async (
  octokit: Octokit,
  args: {
    readonly owner: string
    readonly pullNumber: number
    readonly repo: string
  }
) => {
  const [{ data: authenticatedUser }, { data: reviews }] = await Promise.all([
    octokit.rest.users.getAuthenticated(),
    octokit.rest.pulls.listReviews({
      owner: args.owner,
      pull_number: args.pullNumber,
      repo: args.repo
    })
  ])

  return (
    reviews.find(
      (review) =>
        review.state === 'PENDING' &&
        review.user?.login === authenticatedUser.login
    ) ?? null
  )
}

// Deletes the pending review on GitHub, treating "already gone" (404) as
// success so a stale local draft can still be cleaned up afterwards.
const deletePendingReviewIgnoringMissing = async (
  octokit: Octokit,
  args: {
    readonly owner: string
    readonly pullNumber: number
    readonly repo: string
    readonly reviewId: number
  }
) => {
  try {
    await octokit.rest.pulls.deletePendingReview({
      owner: args.owner,
      pull_number: args.pullNumber,
      repo: args.repo,
      review_id: args.reviewId
    })
  } catch (deleteError) {
    const status = (deleteError as { status?: number }).status

    if (status !== 404) {
      throw deleteError
    }
  }
}

// PENDING review rows are protected from the regular sync clean-up, so once
// the review stops existing on GitHub the local rows must be removed here or
// they resurface as zombie drafts on the next launch.
const cleanUpStalePendingReviews = (pullRequestId: string) =>
  Effect.gen(function* () {
    const repository = yield* Repository

    const removed = yield* repository.softDeletePendingReviews({
      pullRequestId
    })

    if (removed > 0) {
      yield* Effect.promise(() =>
        broadcastPullRequestResourceEvents(pullRequestId)
      )
    }
  })

export const createPendingReview = (input: CreateReviewInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository

    const pullRequest = yield* repository.requirePullRequestByCoords({
      number: input.pullNumber,
      owner: input.owner,
      repo: input.repo
    })

    const octokit = new Octokit({ auth: input.token })

    const data = yield* Effect.tryPromise({
      try: async () => {
        try {
          const response = await octokit.rest.pulls.createReview({
            owner: input.owner,
            pull_number: input.pullNumber,
            repo: input.repo
          })

          return response.data
        } catch (error) {
          const message = error instanceof Error ? error.message : ''

          if (!message.includes('one pending review per pull request')) {
            throw error
          }

          const existing = await findPendingReviewForCurrentUser(octokit, {
            owner: input.owner,
            pullNumber: input.pullNumber,
            repo: input.repo
          })

          if (!existing) {
            throw error
          }

          return existing
        }
      },
      catch: octokitErrorOf('pulls.createReview', {
        transform: (message) =>
          message.includes('one pending review per pull request')
            ? 'You already have a pending review on this pull request'
            : message
      })
    })

    const persisted = yield* repository.upsertReview({
      pullRequestId: pullRequest.id,
      review: toUpsertReviewInput(data)
    })

    yield* Effect.promise(() =>
      broadcastPullRequestResourceEvents(pullRequest.id)
    )

    return toCreateReviewResult(persisted, data.id)
  })

export const getOrSyncPendingReview = (input: GetPendingReviewInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository

    const pullRequest = yield* repository.requirePullRequestByCoords({
      number: input.pullNumber,
      owner: input.owner,
      repo: input.repo
    })

    const octokit = new Octokit({ auth: input.token })

    const existing = yield* Effect.tryPromise({
      try: () =>
        findPendingReviewForCurrentUser(octokit, {
          owner: input.owner,
          pullNumber: input.pullNumber,
          repo: input.repo
        }),
      catch: octokitErrorOf('pulls.listReviews (pending)')
    })

    if (!existing) {
      // GitHub has no pending review for this user, so any local PENDING
      // rows are stale drafts. Clean them up so a zombie draft does not
      // linger in the UI.
      yield* cleanUpStalePendingReviews(pullRequest.id)

      return null
    }

    const persisted = yield* repository.upsertReview({
      pullRequestId: pullRequest.id,
      review: toUpsertReviewInput(existing)
    })

    yield* Effect.promise(() =>
      broadcastPullRequestResourceEvents(pullRequest.id)
    )

    return toCreateReviewResult(persisted, existing.id)
  })

export const deletePendingReview = (input: DeleteReviewInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const octokit = new Octokit({ auth: input.token })

    yield* Effect.tryPromise({
      try: () => deletePendingReviewIgnoringMissing(octokit, input),
      catch: octokitErrorOf('pulls.deletePendingReview')
    })

    const pullRequest = yield* repository.findPullRequestByCoords({
      number: input.pullNumber,
      owner: input.owner,
      repo: input.repo
    })

    if (pullRequest) {
      yield* cleanUpStalePendingReviews(pullRequest.id)
    }

    return { success: true } as const
  })

const triggerDetailSync = (input: {
  readonly owner: string
  readonly pullNumber: number
  readonly pullRequestId: string
  readonly repo: string
}) =>
  Effect.forkDaemon(
    Effect.gen(function* () {
      const result = yield* Effect.either(
        syncPullRequestDetails({
          owner: input.owner,
          pullNumber: input.pullNumber,
          pullRequestId: input.pullRequestId,
          repositoryName: input.repo
        })
      )

      if (result._tag === 'Left') {
        console.error(
          `Failed to sync details after review submit for PR ${input.pullRequestId}:`,
          result.left
        )

        return
      }

      yield* Effect.promise(() =>
        broadcastPullRequestResourceEvents(input.pullRequestId)
      )
    })
  )

export const submitReview = (input: SubmitReviewInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const octokit = new Octokit({ auth: input.token })

    const hasComments = !!input.comments && input.comments.length > 0

    // Set when the pending review stops existing under its original id on
    // GitHub (deleted and recreated, or already gone). The matching local
    // PENDING rows must then be removed — the sync never deletes them.
    let pendingReviewReplaced = false

    if (hasComments) {
      pendingReviewReplaced = true

      yield* Effect.tryPromise({
        try: async () => {
          await deletePendingReviewIgnoringMissing(octokit, input)

          await octokit.rest.pulls.createReview({
            body: input.body ?? '',
            comments: input.comments?.map((comment) => ({
              body: comment.body,
              line: comment.line,
              path: comment.path,
              side: comment.side
            })),
            event: input.event,
            owner: input.owner,
            pull_number: input.pullNumber,
            repo: input.repo
          })
        },
        catch: octokitErrorOf('pulls.createReview (with comments)')
      })
    } else {
      pendingReviewReplaced = yield* Effect.tryPromise({
        try: async () => {
          try {
            await octokit.rest.pulls.submitReview({
              body: input.body ?? '',
              event: input.event,
              owner: input.owner,
              pull_number: input.pullNumber,
              repo: input.repo,
              review_id: input.reviewId
            })

            return false
          } catch (submitError) {
            const status = (submitError as { status?: number }).status

            if (status === 404) {
              await octokit.rest.pulls.createReview({
                body: input.body ?? '',
                event: input.event,
                owner: input.owner,
                pull_number: input.pullNumber,
                repo: input.repo
              })

              return true
            }

            throw submitError
          }
        },
        catch: octokitErrorOf('pulls.submitReview')
      })
    }

    const pullRequest = yield* repository.findPullRequestByCoords({
      number: input.pullNumber,
      owner: input.owner,
      repo: input.repo
    })

    if (pullRequest && pendingReviewReplaced) {
      yield* cleanUpStalePendingReviews(pullRequest.id)
    }

    if (pullRequest) {
      yield* triggerDetailSync({
        owner: input.owner,
        pullNumber: input.pullNumber,
        pullRequestId: pullRequest.id,
        repo: input.repo
      })
    }

    return { success: true } as const
  })
