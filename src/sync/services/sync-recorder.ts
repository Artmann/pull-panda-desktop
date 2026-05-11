import { Context, Effect, Layer, Ref } from 'effect'

import type {
  MonitoringData,
  RateLimitRecord,
  SyncRecord
} from '../../types/syncer-monitoring'
import { RateLimitTracker } from './rate-limit-tracker'

const maxHistorySize = 1000

interface RecorderState {
  syncs: SyncRecord[]
  rateLimits: RateLimitRecord[]
  activePullRequestIds: ReadonlyArray<string>
  syncIdCounter: number
}

const initialState: RecorderState = {
  syncs: [],
  rateLimits: [],
  activePullRequestIds: [],
  syncIdCounter: 0
}

export class SyncRecorder extends Context.Tag('sync/SyncRecorder')<
  SyncRecorder,
  {
    readonly nextSyncId: Effect.Effect<string>
    readonly recordSync: (record: SyncRecord) => Effect.Effect<void>
    readonly recordRateLimitSnapshot: Effect.Effect<void>
    readonly setActivePullRequestIds: (
      ids: ReadonlyArray<string>
    ) => Effect.Effect<void>
    readonly getMonitoringData: Effect.Effect<MonitoringData>
  }
>() {}

export const SyncRecorderLive: Layer.Layer<
  SyncRecorder,
  never,
  RateLimitTracker
> = Layer.effect(
  SyncRecorder,
  Effect.gen(function* () {
    const tracker = yield* RateLimitTracker
    const stateRef = yield* Ref.make<RecorderState>(initialState)

    return {
      nextSyncId: Ref.modify(stateRef, (state) => {
        const next = state.syncIdCounter + 1

        return [`sync-${next}`, { ...state, syncIdCounter: next }]
      }),

      recordSync: (record) =>
        Ref.update(stateRef, (state) => {
          const syncs = [...state.syncs, record]

          while (syncs.length > maxHistorySize) {
            syncs.shift()
          }

          return { ...state, syncs }
        }),

      recordRateLimitSnapshot: Effect.gen(function* () {
        const now = Date.now()
        const rest = yield* tracker.snapshot('rest')
        const graphql = yield* tracker.snapshot('graphql')

        const records: RateLimitRecord[] = []

        if (rest) {
          records.push({
            timestamp: now,
            remaining: rest.remaining,
            limit: rest.limit,
            type: 'rest'
          })
        }

        if (graphql) {
          records.push({
            timestamp: now,
            remaining: graphql.remaining,
            limit: graphql.limit,
            type: 'graphql'
          })
        }

        if (records.length === 0) {
          return
        }

        yield* Ref.update(stateRef, (state) => {
          const rateLimits = [...state.rateLimits, ...records]

          while (rateLimits.length > maxHistorySize) {
            rateLimits.shift()
          }

          return { ...state, rateLimits }
        })
      }),

      setActivePullRequestIds: (ids) =>
        Ref.update(stateRef, (state) => ({
          ...state,
          activePullRequestIds: ids
        })),

      getMonitoringData: Effect.map(Ref.get(stateRef), (state) => ({
        syncs: [...state.syncs],
        rateLimits: [...state.rateLimits],
        activePullRequests: [...state.activePullRequestIds]
      }))
    }
  })
)
