import { Context, Effect, Fiber, Layer, Ref, Schedule } from 'effect'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import { checks, pullRequests } from '../../database/schema'
import { SyncerAlreadyRunningError, SyncerNotStartedError } from '../errors'
import type { MonitoringData } from '../../types/syncer-monitoring'
import { deletePullRequestData } from '../operations/delete-pull-request'
import { syncChecks } from '../operations/sync-checks'
import { syncPullRequestDetails } from '../operations/sync-pull-request-details'
import { Database } from './database'
import { EtagStore } from './etag-store'
import { GitHubGraphQL } from './github-graphql'
import { GitHubRest } from './github-rest'
import { ResourceEventBus } from './resource-event-bus'
import { SyncRecorder } from './sync-recorder'

const focusedPullRequestIntervalMs = 2000
const activeWithRunningChecksIntervalMs = 2000
const activeWithoutRunningChecksIntervalMs = 10000
const idleTickMs = 1000

interface ActivePullRequest {
  id: string
  lastSyncedAt: number
  hasRunningChecks: boolean
}

interface FocusedPullRequest {
  id: string
  lastSyncedAt: number
}

interface SyncerState {
  activePullRequests: Map<string, ActivePullRequest>
  focusedPullRequest: FocusedPullRequest | null
}

const initialState: SyncerState = {
  activePullRequests: new Map(),
  focusedPullRequest: null
}

export class BackgroundSyncer extends Context.Tag('sync/BackgroundSyncer')<
  BackgroundSyncer,
  {
    readonly start: Effect.Effect<void, SyncerAlreadyRunningError>
    readonly stop: Effect.Effect<void, SyncerNotStartedError>
    readonly markPullRequestActive: (
      pullRequestId: string
    ) => Effect.Effect<void>
    readonly setFocusedPullRequest: (
      pullRequestId: string | null
    ) => Effect.Effect<void>
    readonly getFocusedPullRequestId: Effect.Effect<string | null>
    readonly getActivePullRequestIds: Effect.Effect<Set<string>>
    readonly getMonitoringData: Effect.Effect<MonitoringData>
  }
>() {}

type SyncerEnv =
  | Database
  | GitHubGraphQL
  | GitHubRest
  | EtagStore
  | ResourceEventBus
  | SyncRecorder

export const BackgroundSyncerLive: Layer.Layer<
  BackgroundSyncer,
  never,
  SyncerEnv
> = Layer.effect(
  BackgroundSyncer,
  Effect.gen(function* () {
    const database = yield* Database
    const eventBus = yield* ResourceEventBus
    const recorder = yield* SyncRecorder
    const context = yield* Effect.context<SyncerEnv>()

    const stateRef = yield* Ref.make<SyncerState>(initialState)
    const fiberRef = yield* Ref.make<Fiber.RuntimeFiber<unknown, never> | null>(
      null
    )

    const updateActiveIdsSnapshot = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      yield* recorder.setActivePullRequestIds(
        Array.from(state.activePullRequests.keys())
      )
    })

    const runFocusedSync = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const focused = state.focusedPullRequest

      if (!focused) {
        return
      }

      const now = Date.now()

      if (now - focused.lastSyncedAt < focusedPullRequestIntervalMs) {
        return
      }

      const row = yield* database
        .use('backgroundSyncer.focused.lookup', (db) =>
          db
            .select()
            .from(pullRequests)
            .where(eq(pullRequests.id, focused.id))
            .get()
        )
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)))

      if (!row) {
        yield* Ref.update(
          stateRef,
          (current): SyncerState => ({
            ...current,
            focusedPullRequest: null
          })
        )

        return
      }

      const syncId = yield* recorder.nextSyncId
      const syncStart = Date.now()

      const result = yield* syncPullRequestDetails({
        pullRequestId: focused.id,
        owner: row.repositoryOwner,
        repositoryName: row.repositoryName,
        pullNumber: row.number
      })

      if (result.notFound) {
        yield* deletePullRequestData(focused.id).pipe(
          Effect.catchAll((error) =>
            Effect.logError(
              `[BackgroundSyncer] Failed to delete inaccessible PR ${focused.id}: ${String(error)}`
            )
          )
        )

        yield* Ref.update(
          stateRef,
          (current): SyncerState => ({
            ...current,
            focusedPullRequest: null
          })
        )

        yield* eventBus.emitPullRequestUpdates(focused.id)

        yield* recorder.recordSync({
          id: syncId,
          timestamp: syncStart,
          duration: Date.now() - syncStart,
          resourceType: 'details',
          resourceId: focused.id,
          success: false,
          error: 'PR not found on GitHub'
        })

        yield* recorder.recordRateLimitSnapshot

        return
      }

      const success = result.errors.length === 0
      const errorText = success ? undefined : result.errors[0]

      yield* Ref.update(stateRef, (current) => {
        if (!current.focusedPullRequest) {
          return current
        }

        return {
          ...current,
          focusedPullRequest: {
            ...current.focusedPullRequest,
            lastSyncedAt: Date.now()
          }
        }
      })

      yield* eventBus.emitPullRequestUpdates(focused.id)

      yield* recorder.recordSync({
        id: syncId,
        timestamp: syncStart,
        duration: Date.now() - syncStart,
        resourceType: 'details',
        resourceId: focused.id,
        success,
        error: success ? undefined : errorText
      })

      yield* recorder.recordRateLimitSnapshot
    })

    const runOneActiveCheckSync = (item: {
      activePr: ActivePullRequest
      owner: string
      pullNumber: number
      pullRequestId: string
      repositoryName: string
    }) =>
      Effect.gen(function* () {
        const syncId = yield* recorder.nextSyncId
        const syncStart = Date.now()

        const outcome = yield* Effect.either(
          syncChecks({
            pullRequestId: item.pullRequestId,
            owner: item.owner,
            repositoryName: item.repositoryName,
            pullNumber: item.pullNumber
          })
        )

        let hasRunning: boolean | null = null

        if (outcome._tag === 'Right') {
          const runningChecks = yield* database
            .use('backgroundSyncer.runningChecks', (db) =>
              db
                .select()
                .from(checks)
                .where(
                  and(
                    eq(checks.pullRequestId, item.pullRequestId),
                    isNull(checks.deletedAt),
                    inArray(checks.state, ['in_progress', 'queued'])
                  )
                )
                .all()
            )
            .pipe(Effect.catchAll(() => Effect.succeed([])))

          hasRunning = runningChecks.length > 0

          yield* eventBus.emitChecksUpdate(item.pullRequestId)
        }

        // Always advance lastSyncedAt — including on failure — so the next
        // attempt respects the normal active-PR interval rather than retrying
        // every idle tick.
        yield* Ref.update(stateRef, (current) => {
          const next = new Map(current.activePullRequests)
          const existing = next.get(item.pullRequestId)

          if (existing) {
            next.set(item.pullRequestId, {
              ...existing,
              lastSyncedAt: Date.now(),
              hasRunningChecks:
                hasRunning === null ? existing.hasRunningChecks : hasRunning
            })
          }

          return { ...current, activePullRequests: next }
        })

        const success = outcome._tag === 'Right'
        const errorText =
          outcome._tag === 'Left'
            ? `${outcome.left._tag}: ${JSON.stringify(outcome.left)}`
            : undefined

        yield* recorder.recordSync({
          id: syncId,
          timestamp: syncStart,
          duration: Date.now() - syncStart,
          resourceType: 'checks',
          resourceId: item.pullRequestId,
          success,
          error: errorText
        })

        yield* recorder.recordRateLimitSnapshot
      })

    const runActiveChecksSync = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const now = Date.now()

      const candidates: Array<{
        activePr: ActivePullRequest
        owner: string
        pullNumber: number
        pullRequestId: string
        repositoryName: string
      }> = []

      const removableIds: string[] = []

      for (const [pullRequestId, activePr] of state.activePullRequests) {
        const interval = activePr.hasRunningChecks
          ? activeWithRunningChecksIntervalMs
          : activeWithoutRunningChecksIntervalMs

        if (now - activePr.lastSyncedAt < interval) {
          continue
        }

        const row = yield* database
          .use('backgroundSyncer.active.lookup', (db) =>
            db
              .select()
              .from(pullRequests)
              .where(eq(pullRequests.id, pullRequestId))
              .get()
          )
          .pipe(Effect.catchAll(() => Effect.succeed(undefined)))

        if (!row) {
          removableIds.push(pullRequestId)
          continue
        }

        candidates.push({
          activePr,
          owner: row.repositoryOwner,
          pullNumber: row.number,
          pullRequestId,
          repositoryName: row.repositoryName
        })
      }

      if (removableIds.length > 0) {
        yield* Ref.update(stateRef, (current) => {
          const next = new Map(current.activePullRequests)

          for (const id of removableIds) {
            next.delete(id)
          }

          return { ...current, activePullRequests: next }
        })

        yield* updateActiveIdsSnapshot
      }

      yield* Effect.forEach(candidates, runOneActiveCheckSync, {
        concurrency: 3,
        discard: true
      })
    })

    const tick = Effect.gen(function* () {
      yield* runFocusedSync
      yield* runActiveChecksSync
    }).pipe(Effect.catchAllCause((cause) => Effect.logError(cause)))

    const loop = Effect.provide(
      Effect.repeat(tick, Schedule.spaced(`${idleTickMs} millis`)),
      context
    )

    return {
      start: Effect.gen(function* () {
        const existing = yield* Ref.get(fiberRef)

        if (existing) {
          return yield* Effect.fail(new SyncerAlreadyRunningError({}))
        }

        const fiber = yield* Effect.forkDaemon(loop)

        yield* Ref.set(fiberRef, fiber)
        yield* Effect.logInfo('[BackgroundSyncer] Started')
      }),

      stop: Effect.gen(function* () {
        const existing = yield* Ref.get(fiberRef)

        if (!existing) {
          return yield* Effect.fail(new SyncerNotStartedError({}))
        }

        yield* Fiber.interrupt(existing)
        yield* Ref.set(fiberRef, null)
        yield* Effect.logInfo('[BackgroundSyncer] Stopped')
      }),

      markPullRequestActive: (pullRequestId) =>
        Effect.gen(function* () {
          let changed = false

          yield* Ref.update(stateRef, (current) => {
            if (current.activePullRequests.has(pullRequestId)) {
              return current
            }

            changed = true

            const next = new Map(current.activePullRequests)

            next.set(pullRequestId, {
              id: pullRequestId,
              lastSyncedAt: 0,
              hasRunningChecks: false
            })

            return { ...current, activePullRequests: next }
          })

          if (changed) {
            yield* updateActiveIdsSnapshot
          }
        }),

      setFocusedPullRequest: (pullRequestId) =>
        Ref.update(stateRef, (current) => {
          if (pullRequestId === null) {
            return { ...current, focusedPullRequest: null }
          }

          if (current.focusedPullRequest?.id === pullRequestId) {
            return current
          }

          return {
            ...current,
            focusedPullRequest: { id: pullRequestId, lastSyncedAt: 0 }
          }
        }),

      getFocusedPullRequestId: Effect.map(
        Ref.get(stateRef),
        (state) => state.focusedPullRequest?.id ?? null
      ),

      getActivePullRequestIds: Effect.map(
        Ref.get(stateRef),
        (state) => new Set(state.activePullRequests.keys())
      ),

      getMonitoringData: recorder.getMonitoringData
    }
  })
)
