import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import { checks, type NewCheck } from '../database/schema'

import { createRestClient } from './rest-client'
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

// In-memory cache for head SHAs to avoid refetching PR on 304
const headShaCache = new Map<string, string>()

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

    // First, get the PR to find the head SHA (with ETag support)
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

    let commitSha: string | null = null

    // If PR unchanged (304), use cached SHA
    if (prResult.notModified) {
      commitSha = headShaCache.get(pullRequestId) ?? null

      if (!commitSha) {
        console.log(
          `[syncChecks] PR returned 304 but no cached SHA for #${pullNumber}`
        )
        console.timeEnd('syncChecks')

        return
      }

      console.log(
        `[syncChecks] PR unchanged for #${pullNumber} (304), using cached SHA`
      )
    } else if (prResult.data) {
      commitSha = prResult.data.head.sha

      // Cache the SHA for future 304 responses
      headShaCache.set(pullRequestId, commitSha)

      // Store PR ETag for future requests
      if (prResult.etag) {
        etagManager.set(
          prEtagKey,
          prResult.etag,
          prResult.lastModified ?? undefined
        )
      }
    }

    if (!commitSha) {
      console.log(`[syncChecks] Could not get PR #${pullNumber}`)
      console.timeEnd('syncChecks')

      return
    }

    const etagKey = { endpointType: 'checks', resourceId: pullRequestId }

    // Look up cached ETag
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

    // Skip processing on 304 Not Modified
    if (result.notModified) {
      console.log(`[syncChecks] No changes for PR #${pullNumber} (304)`)
      console.timeEnd('syncChecks')

      return
    }

    const checkRuns = result.data?.check_runs ?? []

    console.log(
      `Found ${checkRuns.length} check runs for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

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

      const durationInSeconds =
        checkRun.started_at && checkRun.completed_at
          ? Math.round(
              (new Date(checkRun.completed_at).getTime() -
                new Date(checkRun.started_at).getTime()) /
                1000
            )
          : null

      const existingCheck = existingChecks.find((c) => c.gitHubId === gitHubId)

      const checkData: NewCheck = {
        id: existingCheck?.id ?? generateId(),
        gitHubId,
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

    // Soft delete checks that no longer exist
    for (const existingCheck of existingChecks) {
      if (!syncedGitHubIds.includes(existingCheck.gitHubId)) {
        database
          .update(checks)
          .set({ deletedAt: now })
          .where(eq(checks.id, existingCheck.id))
          .run()
      }
    }

    // Remove duplicates (same commitSha + name)
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

    // Store the new ETag
    if (result.etag) {
      etagManager.set(etagKey, result.etag, result.lastModified ?? undefined)
    }

    console.timeEnd('syncChecks')
  } catch (error) {
    console.timeEnd('syncChecks')

    const errorMessage = error instanceof Error ? error.message : String(error)
    const isPermissionError =
      errorMessage.includes('Resource not accessible by integration') ||
      errorMessage.includes('Resource not accessible')

    if (isPermissionError) {
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
