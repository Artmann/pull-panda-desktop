import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import { checks, type NewCheck } from '../database/schema'

import { createRestClient, type RestClient } from './rest-client'
import { etagManager } from './etag-manager'
import { generateId } from './utils'

interface SyncChecksParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

interface CheckRunData {
  id: number
  name: string
  status: string | null
  conclusion: string | null
  started_at: string | null
  completed_at: string | null
  details_url: string | null
  head_sha: string
  output?: {
    title?: string | null
    summary?: string | null
  }
  check_suite?: {
    id: number
  }
  app?: {
    name?: string
  }
}

interface CheckRunsResponse {
  total_count: number
  check_runs: CheckRunData[]
}

interface PullRequestData {
  head: {
    sha: string
  }
}

const headShaCache = new Map<string, string>()

async function resolveCommitSha(
  client: RestClient,
  pullRequestId: string,
  owner: string,
  repositoryName: string,
  pullNumber: number
): Promise<string | null> {
  const prEtagKey = { endpointType: 'pr-head-sha', resourceId: pullRequestId }
  const cachedPrEtag = etagManager.get(prEtagKey)

  const prResult = await client.request<PullRequestData>(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}',
    {
      owner,
      repo: repositoryName,
      pull_number: pullNumber
    },
    { etag: cachedPrEtag?.etag ?? undefined }
  )

  if (prResult.notModified) {
    const cached = headShaCache.get(pullRequestId) ?? null

    if (cached) {
      return cached
    }

    // Cold start: persisted etag is valid but in-memory SHA cache is empty.
    // Drop the etag and refetch so we can populate the cache.
    console.log(
      `[syncChecks] PR returned 304 but no cached SHA for #${pullNumber} — refetching`
    )
    etagManager.delete(prEtagKey)

    const refreshed = await client.request<PullRequestData>(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner,
        repo: repositoryName,
        pull_number: pullNumber
      }
    )

    if (!refreshed.data) {
      return null
    }

    const refreshedSha = refreshed.data.head.sha
    headShaCache.set(pullRequestId, refreshedSha)

    if (refreshed.etag) {
      etagManager.set(
        prEtagKey,
        refreshed.etag,
        refreshed.lastModified ?? undefined
      )
    }

    return refreshedSha
  }

  if (!prResult.data) {
    return null
  }

  const commitSha = prResult.data.head.sha
  headShaCache.set(pullRequestId, commitSha)

  if (prResult.etag) {
    etagManager.set(
      prEtagKey,
      prResult.etag,
      prResult.lastModified ?? undefined
    )
  }

  return commitSha
}

function buildCheckData(
  checkRun: CheckRunData,
  existingId: string | undefined,
  pullRequestId: string,
  commitSha: string,
  now: string
): NewCheck {
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

function upsertCheckRuns(
  checkRuns: CheckRunData[],
  pullRequestId: string,
  commitSha: string,
  now: string
): string[] {
  const database = getDatabase()

  const existingChecks = database
    .select()
    .from(checks)
    .where(
      and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
    )
    .all()

  const syncedGitHubIds: string[] = []

  for (const checkRun of checkRuns) {
    const gitHubId = String(checkRun.id)
    syncedGitHubIds.push(gitHubId)

    const existingCheck = existingChecks.find((c) => c.gitHubId === gitHubId)
    const checkData = buildCheckData(
      checkRun,
      existingCheck?.id,
      pullRequestId,
      commitSha,
      now
    )

    database
      .insert(checks)
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
      database
        .update(checks)
        .set({ deletedAt: now })
        .where(eq(checks.id, existingCheck.id))
        .run()
    }
  }

  return syncedGitHubIds
}

function removeDuplicateChecks(pullRequestId: string, now: string): void {
  const database = getDatabase()

  const syncedChecks = database
    .select()
    .from(checks)
    .where(
      and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
    )
    .all()

  for (const check of syncedChecks) {
    const duplicates = syncedChecks.filter(
      (other) =>
        check.commitSha === other.commitSha &&
        check.name === other.name &&
        check.id !== other.id
    )

    for (const duplicate of duplicates) {
      database
        .update(checks)
        .set({ deletedAt: now })
        .where(eq(checks.id, duplicate.id))
        .run()
    }
  }
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return (
    message.includes('Resource not accessible by integration') ||
    message.includes('Resource not accessible')
  )
}

export async function syncChecks({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncChecksParams): Promise<void> {
  console.time('syncChecks')

  try {
    const client = createRestClient(token)
    const commitSha = await resolveCommitSha(
      client,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    )

    if (!commitSha) {
      console.log(`[syncChecks] Could not get PR #${pullNumber}`)
      console.timeEnd('syncChecks')

      return
    }

    const etagKey = { endpointType: 'checks', resourceId: pullRequestId }
    const cached = etagManager.get(etagKey)

    const result = await client.request<CheckRunsResponse>(
      'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
      {
        owner,
        repo: repositoryName,
        ref: commitSha,
        per_page: 100
      },
      { etag: cached?.etag ?? undefined }
    )

    if (result.notModified) {
      console.log(`[syncChecks] No changes for PR #${pullNumber} (304)`)
      console.timeEnd('syncChecks')

      return
    }

    const checkRuns = result.data?.check_runs ?? []

    console.log(
      `Found ${checkRuns.length} check runs for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const now = new Date().toISOString()

    upsertCheckRuns(checkRuns, pullRequestId, commitSha, now)
    removeDuplicateChecks(pullRequestId, now)

    if (result.etag) {
      etagManager.set(etagKey, result.etag, result.lastModified ?? undefined)
    }

    console.timeEnd('syncChecks')
  } catch (error) {
    console.timeEnd('syncChecks')

    if (isPermissionError(error)) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      console.warn('Permission error syncing checks', {
        error: errorMessage,
        owner,
        pullNumber,
        repository: repositoryName
      })
    } else {
      console.error('Error syncing pull request checks:', error)
      throw error
    }
  }
}
