import { Octokit } from '@octokit/rest'
import { Effect } from 'effect'

import { syncPullRequestDetails } from '../../../sync/operations/sync-pull-request-details'
import { Repository } from '../../services/repository'
import { broadcastPullRequestResourceEvents } from '../../send-resource-events'
import { OctokitError } from '../errors'

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

const octokitErrorOf =
  (operation: string, fallback?: (message: string) => string) =>
  (cause: unknown) => {
    const status =
      typeof cause === 'object' &&
      cause !== null &&
      'status' in cause &&
      typeof (cause as { status: unknown }).status === 'number'
        ? (cause as { status: number }).status
        : 500
    const rawMessage =
      cause instanceof Error ? cause.message : `Failed: ${operation}`
    const message = fallback ? fallback(rawMessage) : rawMessage

    return new OctokitError({ message, operation, status })
  }

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

          const { data: authenticatedUser } =
            await octokit.rest.users.getAuthenticated()
          const { data: reviews } = await octokit.rest.pulls.listReviews({
            owner: input.owner,
            pull_number: input.pullNumber,
            repo: input.repo
          })

          const existing = reviews.find(
            (review) =>
              review.state === 'PENDING' &&
              review.user?.login === authenticatedUser.login
          )

          if (!existing) {
            throw error
          }

          return existing
        }
      },
      catch: octokitErrorOf('pulls.createReview', (message) =>
        message.includes('one pending review per pull request')
          ? 'You already have a pending review on this pull request'
          : message
      )
    })

    const persisted = yield* repository.upsertReview({
      pullRequestId: pullRequest.id,
      review: {
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
      }
    })

    yield* Effect.promise(() =>
      broadcastPullRequestResourceEvents(pullRequest.id)
    )

    const result: CreateReviewResult = {
      authorAvatarUrl: persisted.authorAvatarUrl,
      authorLogin: persisted.authorLogin,
      body: persisted.body,
      gitHubId: persisted.gitHubId,
      gitHubNumericId: persisted.gitHubNumericId ?? data.id,
      id: persisted.id,
      state: persisted.state
    }

    return result
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
      try: async () => {
        const { data: authenticatedUser } =
          await octokit.rest.users.getAuthenticated()
        const { data: reviews } = await octokit.rest.pulls.listReviews({
          owner: input.owner,
          pull_number: input.pullNumber,
          repo: input.repo
        })

        return (
          reviews.find(
            (review) =>
              review.state === 'PENDING' &&
              review.user?.login === authenticatedUser.login
          ) ?? null
        )
      },
      catch: octokitErrorOf('pulls.listReviews (pending)')
    })

    if (!existing) {
      return null
    }

    const persisted = yield* repository.upsertReview({
      pullRequestId: pullRequest.id,
      review: {
        authorAvatarUrl: existing.user?.avatar_url ?? null,
        authorLogin: existing.user?.login ?? null,
        body: existing.body ?? null,
        bodyHtml: existing.body_html ?? null,
        gitHubCreatedAt: existing.submitted_at ?? null,
        gitHubId: existing.node_id,
        gitHubNumericId: existing.id,
        gitHubSubmittedAt: existing.submitted_at ?? null,
        state: existing.state,
        url: existing.html_url ?? null
      }
    })

    yield* Effect.promise(() =>
      broadcastPullRequestResourceEvents(pullRequest.id)
    )

    const result: CreateReviewResult = {
      authorAvatarUrl: persisted.authorAvatarUrl,
      authorLogin: persisted.authorLogin,
      body: persisted.body,
      gitHubId: persisted.gitHubId,
      gitHubNumericId: persisted.gitHubNumericId ?? existing.id,
      id: persisted.id,
      state: persisted.state
    }

    return result
  })

export const deletePendingReview = (input: DeleteReviewInput) =>
  Effect.gen(function* () {
    const octokit = new Octokit({ auth: input.token })

    yield* Effect.tryPromise({
      try: async () => {
        await octokit.rest.pulls.deletePendingReview({
          owner: input.owner,
          pull_number: input.pullNumber,
          repo: input.repo,
          review_id: input.reviewId
        })
      },
      catch: octokitErrorOf('pulls.deletePendingReview')
    })

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

    if (hasComments) {
      yield* Effect.tryPromise({
        try: async () => {
          try {
            await octokit.rest.pulls.deletePendingReview({
              owner: input.owner,
              pull_number: input.pullNumber,
              repo: input.repo,
              review_id: input.reviewId
            })
          } catch (deleteError) {
            const status = (deleteError as { status?: number }).status

            if (status !== 404) {
              throw deleteError
            }
          }

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
      yield* Effect.tryPromise({
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

              return
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
