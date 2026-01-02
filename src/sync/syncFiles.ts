import { Octokit } from '@octokit/rest'
import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import { modifiedFiles, type NewModifiedFile } from '../database/schema'

import { generateId } from './utils'

interface SyncFilesParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

export async function syncFiles({
  token,
  pullRequestId,
  owner,
  repositoryName,
  pullNumber
}: SyncFilesParams): Promise<void> {
  console.time('syncFiles')

  try {
    const octokit = new Octokit({ auth: token })

    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo: repositoryName,
      pull_number: pullNumber,
      per_page: 100
    })

    console.log(
      `Found ${response.data.length} modified files for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingFiles = await database
      .select()
      .from(modifiedFiles)
      .where(
        and(
          eq(modifiedFiles.pullRequestId, pullRequestId),
          isNull(modifiedFiles.deletedAt)
        )
      )

    const syncedFilenames: string[] = []

    for (const fileData of response.data) {
      const filename = fileData.filename
      syncedFilenames.push(filename)

      const existingFile = existingFiles.find((f) => f.filename === filename)

      const file: NewModifiedFile = {
        id: existingFile?.id ?? generateId(),
        pullRequestId,
        filename,
        filePath: filename,
        status: fileData.status ?? null,
        additions: fileData.additions ?? null,
        deletions: fileData.deletions ?? null,
        changes: fileData.changes ?? null,
        diffHunk: fileData.patch ?? null,
        syncedAt: now,
        deletedAt: null
      }

      await database
        .insert(modifiedFiles)
        .values(file)
        .onConflictDoUpdate({
          target: modifiedFiles.id,
          set: {
            filename: file.filename,
            filePath: file.filePath,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            diffHunk: file.diffHunk,
            syncedAt: file.syncedAt,
            deletedAt: null
          }
        })
    }

    for (const existingFile of existingFiles) {
      if (!syncedFilenames.includes(existingFile.filename)) {
        await database
          .update(modifiedFiles)
          .set({ deletedAt: now })
          .where(eq(modifiedFiles.id, existingFile.id))
      }
    }

    console.timeEnd('syncFiles')
  } catch (error) {
    console.timeEnd('syncFiles')
    console.error('Error syncing pull request files:', error)
    throw error
  }
}
