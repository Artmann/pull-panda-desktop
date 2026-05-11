import { Effect, Option } from 'effect'
import { and, eq, isNull } from 'drizzle-orm'

import { checks, type NewCheck } from '../../database/schema'
import {
  SyncDetailFailedError,
  type SyncError
} from '../errors'
import {
  CheckRunsResponseSchema,
  PullRequestHeadShaSchema,
  type CheckRun
} from '../schemas/github-rest'
import { Database } from '../services/database'
import { EtagStore } from '../services/etag-store'
import { GitHubRest } from '../services/github-rest'
import { generateId } from '../shared/utils'

export interface SyncChecksParams {
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

const headShaCache = new Map<string, string>()

const fetchHeadSha = (
  params: SyncChecksParams
): Effect.Effect<Option.Option<{ head: { sha: string } }>, SyncError, GitHubRest> =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest

    return yield* rest
      .request(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}',
        {
          owner: params.owner,
          repo: params.repositoryName,
          pull_number: params.pullNumber
        },
        PullRequestHeadShaSchema,
        {
          etagKey: {
            endpointType: 'pr-head-sha',
            resourceId: params.pullRequestId
          }
        }
      )
      .pipe(
        Effect.catchTag('PermissionError', () =>
          Effect.succeed(Option.none<{ head: { sha: string } }>())
        ),
        Effect.mapError(
          (cause) =>
            new SyncDetailFailedError({
              operation: 'pr-head-sha',
              pullRequestId: params.pullRequestId,
              cause
            }) as SyncError
        )
      )
  })

const resolveCommitSha = (
  params: SyncChecksParams
): Effect.Effect<string | null, SyncError, GitHubRest | EtagStore> =>
  Effect.gen(function* () {
    const etagStore = yield* EtagStore
    const etagKey = {
      endpointType: 'pr-head-sha',
      resourceId: params.pullRequestId
    }

    const initial = yield* fetchHeadSha(params)

    if (Option.isSome(initial)) {
      const sha = initial.value.head.sha
      headShaCache.set(params.pullRequestId, sha)
      return sha
    }

    const cached = headShaCache.get(params.pullRequestId)

    if (cached) {
      return cached
    }

    yield* etagStore
      .remove(etagKey)
      .pipe(Effect.catchAll(() => Effect.void))

    const refreshed = yield* fetchHeadSha(params)

    if (Option.isNone(refreshed)) {
      return null
    }

    const sha = refreshed.value.head.sha
    headShaCache.set(params.pullRequestId, sha)
    return sha
  })

const buildCheck = (
  checkRun: CheckRun,
  existingId: string | undefined,
  pullRequestId: string,
  commitSha: string,
  now: string
): NewCheck => {
  const durationInSeconds =
    checkRun.started_at && checkRun.completed_at
      ? Math.round(
          (new Date(checkRun.completed_at).getTime() -
            new Date(checkRun.started_at).getTime()) /
            1000
        )
      : null

  return {
    id: existingId ?? generateId(),
    gitHubId: String(checkRun.id),
    pullRequestId,
    name: checkRun.name,
    state: checkRun.status,
    conclusion: checkRun.conclusion,
    commitSha,
    suiteName: checkRun.app?.name ?? null,
    durationInSeconds,
    detailsUrl: checkRun.details_url,
    message: checkRun.output?.summary ?? null,
    url: checkRun.details_url,
    gitHubCreatedAt: checkRun.started_at,
    gitHubUpdatedAt: checkRun.completed_at ?? checkRun.started_at,
    syncedAt: now,
    deletedAt: null
  }
}

export const syncChecks = (
  params: SyncChecksParams
): Effect.Effect<void, SyncError, Database | GitHubRest | EtagStore> =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest
    const database = yield* Database

    const commitSha = yield* resolveCommitSha(params)

    if (!commitSha) {
      return
    }

    const result = yield* rest
      .request(
        'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
        {
          owner: params.owner,
          repo: params.repositoryName,
          ref: commitSha,
          per_page: 100
        },
        CheckRunsResponseSchema,
        {
          etagKey: { endpointType: 'checks', resourceId: params.pullRequestId }
        }
      )
      .pipe(
        Effect.catchTag('PermissionError', () =>
          Effect.succeed(
            Option.none<{
              total_count: number
              check_runs: ReadonlyArray<CheckRun>
            }>()
          )
        ),
        Effect.mapError(
          (cause) =>
            new SyncDetailFailedError({
              operation: 'checks',
              pullRequestId: params.pullRequestId,
              cause
            }) as SyncError
        )
      )

    if (Option.isNone(result)) {
      return
    }

    const checkRuns = result.value.check_runs as ReadonlyArray<CheckRun>
    const now = new Date().toISOString()

    yield* database.use('syncChecks.upsert', (db) => {
      const existingChecks = db
        .select()
        .from(checks)
        .where(
          and(
            eq(checks.pullRequestId, params.pullRequestId),
            isNull(checks.deletedAt)
          )
        )
        .all()

      const syncedGitHubIds: string[] = []

      for (const checkRun of checkRuns) {
        const gitHubId = String(checkRun.id)
        syncedGitHubIds.push(gitHubId)

        const existingCheck = existingChecks.find(
          (row) => row.gitHubId === gitHubId
        )
        const checkData = buildCheck(
          checkRun,
          existingCheck?.id,
          params.pullRequestId,
          commitSha,
          now
        )

        db.insert(checks)
          .values(checkData)
          .onConflictDoUpdate({
            target: checks.id,
            set: {
              name: checkData.name,
              state: checkData.state,
              conclusion: checkData.conclusion,
              commitSha: checkData.commitSha,
              suiteName: checkData.suiteName,
              durationInSeconds: checkData.durationInSeconds,
              detailsUrl: checkData.detailsUrl,
              message: checkData.message,
              url: checkData.url,
              gitHubCreatedAt: checkData.gitHubCreatedAt,
              gitHubUpdatedAt: checkData.gitHubUpdatedAt,
              syncedAt: checkData.syncedAt,
              deletedAt: null
            }
          })
          .run()
      }

      for (const existingCheck of existingChecks) {
        if (!syncedGitHubIds.includes(existingCheck.gitHubId)) {
          db.update(checks)
            .set({ deletedAt: now })
            .where(eq(checks.id, existingCheck.id))
            .run()
        }
      }
    })

    yield* database.use('syncChecks.dedupe', (db) => {
      const activeChecks = db
        .select()
        .from(checks)
        .where(
          and(
            eq(checks.pullRequestId, params.pullRequestId),
            isNull(checks.deletedAt)
          )
        )
        .all()

      for (const check of activeChecks) {
        const duplicates = activeChecks.filter(
          (other) =>
            check.commitSha === other.commitSha &&
            check.name === other.name &&
            check.id !== other.id
        )

        for (const duplicate of duplicates) {
          db.update(checks)
            .set({ deletedAt: now })
            .where(eq(checks.id, duplicate.id))
            .run()
        }
      }
    })
  })
