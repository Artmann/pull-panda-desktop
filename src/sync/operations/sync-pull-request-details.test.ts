import { Duration, Effect, Layer, Option, Ref } from 'effect'
import { describe, expect, it } from 'vitest'

import { NotFoundError, SyncDetailFailedError } from '../errors'
import { Database } from '../services/database'
import { EtagStore } from '../services/etag-store'
import { GitHubGraphQL } from '../services/github-graphql'
import { GitHubRest } from '../services/github-rest'
import {
  __testing,
  runDetailsWithOperations,
  syncPullRequestDetails,
  type NamedOperation,
  type SyncPullRequestDetailsParams
} from './sync-pull-request-details'

// Bare-bones service stubs. The orchestration tests never reach the underlying
// transport or DB, so the layers can return trivial values.
const StubDatabase = Layer.succeed(Database, {
  use: <A>(_operation: string, _fn: (db: never) => A) =>
    Effect.succeed(undefined as A)
})

const StubGitHubRest = Layer.succeed(GitHubRest, {
  request: <A>() => Effect.succeed(Option.none<A>())
})

const StubGitHubGraphQL = Layer.succeed(GitHubGraphQL, {
  query: <A>() => Effect.succeed(undefined as A)
})

const StubEtagStore = Layer.succeed(EtagStore, {
  get: () => Effect.succeed(Option.none()),
  set: () => Effect.void,
  remove: () => Effect.void
})

const TestLayer = Layer.mergeAll(
  StubDatabase,
  StubGitHubRest,
  StubGitHubGraphQL,
  StubEtagStore
)

const params: SyncPullRequestDetailsParams = {
  pullRequestId: 'PR_test',
  owner: 'octocat',
  repositoryName: 'demo',
  pullNumber: 42
}

const trackedOperation = (
  name: string,
  counter: Ref.Ref<ReadonlyArray<string>>,
  body: Effect.Effect<void, NotFoundError | SyncDetailFailedError>
): NamedOperation => ({
  name,
  effect: Ref.update(counter, (calls) => [...calls, name]).pipe(
    Effect.flatMap(() => body)
  )
})

describe('sync-pull-request-details orchestration', () => {
  it('short-circuits when an operation returns NotFoundError', async () => {
    const counter = Ref.unsafeMake<ReadonlyArray<string>>([])

    const operations: ReadonlyArray<NamedOperation> = [
      trackedOperation('Checks', counter, Effect.void),
      trackedOperation(
        'Commits',
        counter,
        Effect.fail(new NotFoundError({ route: 'commits', resourceId: null }))
      ),
      trackedOperation('Files', counter, Effect.void),
      trackedOperation('Reviews', counter, Effect.void)
    ]

    const result = await Effect.runPromise(
      Effect.provide(runDetailsWithOperations(params, operations), TestLayer)
    )

    const calls = await Effect.runPromise(Ref.get(counter))

    expect(result).toEqual({
      errors: [],
      notFound: true,
      success: false
    })
    expect(calls).toEqual(['Checks', 'Commits'])
  })

  it('treats a SyncDetailFailedError caused by NotFoundError as not-found', async () => {
    const counter = Ref.unsafeMake<ReadonlyArray<string>>([])

    const wrapped = new SyncDetailFailedError({
      operation: 'reviews',
      pullRequestId: params.pullRequestId,
      cause: new NotFoundError({ route: 'reviews', resourceId: null })
    })

    const operations: ReadonlyArray<NamedOperation> = [
      trackedOperation('Reviews', counter, Effect.fail(wrapped)),
      trackedOperation('Comments', counter, Effect.void)
    ]

    const result = await Effect.runPromise(
      Effect.provide(runDetailsWithOperations(params, operations), TestLayer)
    )

    const calls = await Effect.runPromise(Ref.get(counter))

    expect(result.notFound).toEqual(true)
    expect(calls).toEqual(['Reviews'])
  })

  it('accumulates non-fatal failures across operations', async () => {
    const counter = Ref.unsafeMake<ReadonlyArray<string>>([])

    const reviewsFailure = new SyncDetailFailedError({
      operation: 'reviews',
      pullRequestId: params.pullRequestId,
      cause: { _tag: 'NetworkError' }
    })

    const filesFailure = new SyncDetailFailedError({
      operation: 'files',
      pullRequestId: params.pullRequestId,
      cause: { _tag: 'HttpError' }
    })

    const operations: ReadonlyArray<NamedOperation> = [
      trackedOperation('Commits', counter, Effect.void),
      trackedOperation('Reviews', counter, Effect.fail(reviewsFailure)),
      trackedOperation('Files', counter, Effect.fail(filesFailure)),
      trackedOperation('Comments', counter, Effect.void)
    ]

    const result = await Effect.runPromise(
      Effect.provide(runDetailsWithOperations(params, operations), TestLayer)
    )

    const calls = await Effect.runPromise(Ref.get(counter))

    expect(result.notFound).toEqual(false)
    expect(result.success).toEqual(false)
    expect(result.errors.length).toEqual(2)
    expect(
      result.errors.some((entry) => entry.startsWith('Reviews sync failed:'))
    ).toEqual(true)
    expect(
      result.errors.some((entry) => entry.startsWith('Files sync failed:'))
    ).toEqual(true)
    expect(calls).toEqual(['Commits', 'Reviews', 'Files', 'Comments'])
  })

  it('de-duplicates concurrent syncPullRequestDetails calls on the same PR', async () => {
    // Ensure no prior test left a fiber pinned to this id.
    __testing.inFlight.delete(params.pullRequestId)

    const restCalls = Ref.unsafeMake(0)
    const graphqlCalls = Ref.unsafeMake(0)

    // Counting stubs that also sleep so concurrent invocations overlap and
    // the second/third callers actually find the first call's fiber in
    // inFlight.
    const CountingRest = Layer.succeed(GitHubRest, {
      request: <A>() =>
        Ref.update(restCalls, (n) => n + 1).pipe(
          Effect.flatMap(() => Effect.sleep(Duration.millis(20))),
          Effect.map(() => Option.none<A>())
        )
    })

    // syncReviewThreads decodes the response and reads
    // `response.repository?.pullRequest` — return a shape that makes the op
    // gracefully early-exit instead of throwing inside the operation body.
    const emptyReviewThreadsResponse = {
      repository: null,
      rateLimit: { cost: 0, limit: 0, remaining: 0, resetAt: '' }
    } as unknown

    const CountingGraphQL = Layer.succeed(GitHubGraphQL, {
      query: <A>() =>
        Ref.update(graphqlCalls, (n) => n + 1).pipe(
          Effect.flatMap(() => Effect.sleep(Duration.millis(20))),
          Effect.map(() => emptyReviewThreadsResponse as A)
        )
    })

    const DedupeLayer = Layer.mergeAll(
      StubDatabase,
      CountingRest,
      CountingGraphQL,
      StubEtagStore
    )

    // Baseline: how many transport calls does a single sync trigger?
    const baselineResult = await Effect.runPromise(
      Effect.provide(syncPullRequestDetails(params), DedupeLayer)
    )

    const baselineRestCalls = await Effect.runPromise(Ref.get(restCalls))
    const baselineGraphqlCalls = await Effect.runPromise(Ref.get(graphqlCalls))

    expect(baselineResult.notFound).toEqual(false)
    expect(baselineRestCalls).toBeGreaterThan(0)

    // Reset counters, then fire three concurrent calls for the same PR. With
    // de-duplication the underlying runDetails should execute exactly once,
    // so the transport call counts should match the single-run baseline.
    await Effect.runPromise(Ref.set(restCalls, 0))
    await Effect.runPromise(Ref.set(graphqlCalls, 0))

    const concurrentResults = await Effect.runPromise(
      Effect.provide(
        Effect.all(
          [
            syncPullRequestDetails(params),
            syncPullRequestDetails(params),
            syncPullRequestDetails(params)
          ],
          { concurrency: 'unbounded' }
        ),
        DedupeLayer
      )
    )

    const concurrentRestCalls = await Effect.runPromise(Ref.get(restCalls))
    const concurrentGraphqlCalls = await Effect.runPromise(
      Ref.get(graphqlCalls)
    )

    expect(concurrentResults.length).toEqual(3)
    expect(concurrentRestCalls).toEqual(baselineRestCalls)
    expect(concurrentGraphqlCalls).toEqual(baselineGraphqlCalls)

    // And once the in-flight fiber is gone, subsequent calls run the work
    // again — `Effect.ensuring` should have cleared the map.
    await Effect.runPromise(Ref.set(restCalls, 0))

    await Effect.runPromise(
      Effect.provide(syncPullRequestDetails(params), DedupeLayer)
    )

    const followupRestCalls = await Effect.runPromise(Ref.get(restCalls))

    expect(followupRestCalls).toEqual(baselineRestCalls)
  })
})
