import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import { checks, type NewCheck } from '../database/schema'

import { createGraphqlClient } from './graphql'
import { checksQuery, type ChecksQueryResponse } from './queries'
import { generateId } from './utils'

interface SyncChecksParams {
  client: ReturnType<typeof createGraphqlClient>
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export async function syncChecks({
  client,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncChecksParams): Promise<void> {
  console.time('syncChecks')

  try {
    const response = await client<ChecksQueryResponse>(checksQuery, {
      owner,
      repo: repositoryName,
      pullNumber
    })

    const commitNode = response.repository?.pullRequest?.commits?.nodes?.[0]
    const commitSha = commitNode?.commit.oid ?? ''
    const statusCheckNodes =
      commitNode?.commit.statusCheckRollup?.contexts?.nodes?.filter(
        (node) => node !== null
      ) ?? []

    console.log(
      `Found ${statusCheckNodes.length} status checks for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingChecks = await database
      .select()
      .from(checks)
      .where(
        and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
      )

    const syncedGitHubIds: string[] = []

    for (const checkNode of statusCheckNodes) {
      if (!checkNode || checkNode.__typename !== 'CheckRun') {
        continue
      }

      const gitHubId = checkNode.id
      syncedGitHubIds.push(gitHubId)

      const durationInSeconds =
        checkNode.startedAt && checkNode.completedAt
          ? Math.round(
              (new Date(checkNode.completedAt).getTime() -
                new Date(checkNode.startedAt).getTime()) /
                1000
            )
          : undefined

      const workflowName =
        checkNode.checkSuite?.workflowRun?.workflow?.name ?? ''
      const checkName = checkNode.name ?? ''

      const existingCheck = existingChecks.find((c) => c.gitHubId === gitHubId)

      const checkData: NewCheck = {
        id: existingCheck?.id ?? generateId(),
        gitHubId,
        pullRequestId,
        name: checkName,
        state: checkNode.status ?? null,
        conclusion: checkNode.conclusion ?? null,
        commitSha,
        suiteName: workflowName,
        durationInSeconds: durationInSeconds ?? null,
        detailsUrl: checkNode.detailsUrl ?? null,
        message: checkNode.text ?? checkNode.summary ?? null,
        url: checkNode.detailsUrl ?? null,
        gitHubCreatedAt: checkNode.startedAt ?? null,
        gitHubUpdatedAt: checkNode.completedAt ?? checkNode.startedAt ?? null,
        syncedAt: now,
        deletedAt: null
      }

      await database
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
    }

    for (const existingCheck of existingChecks) {
      if (!syncedGitHubIds.includes(existingCheck.gitHubId)) {
        await database
          .update(checks)
          .set({ deletedAt: now })
          .where(eq(checks.id, existingCheck.id))
      }
    }

    const syncedChecks = await database
      .select()
      .from(checks)
      .where(
        and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
      )

    for (const check of syncedChecks) {
      const duplicates = syncedChecks.filter(
        (other) =>
          check.commitSha === other.commitSha &&
          check.name === other.name &&
          check.id !== other.id
      )

      for (const duplicate of duplicates) {
        await database
          .update(checks)
          .set({ deletedAt: now })
          .where(eq(checks.id, duplicate.id))
      }
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
