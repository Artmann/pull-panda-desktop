import { eq, and, isNull } from 'drizzle-orm'

import { getDatabase } from '../database'
import { modifiedFiles, type NewModifiedFile } from '../database/schema'

import { createRestClient } from './restClient'
import { etagManager } from './etagManager'
import { generateId } from './utils'

interface SyncFilesParams {
  token: string
  pullRequestId: string
  owner: string
  repositoryName: string
  pullNumber: number
}

interface FileData {
  filename: string
  status?: string
  additions?: number
  deletions?: number
  changes?: number
  patch?: string
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
    const client = createRestClient(token)
    const etagKey = { endpointType: 'files', resourceId: pullRequestId }

    // Look up cached ETag
    const cached = etagManager.get(etagKey)

    const result = await client.request<FileData[]>(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner,
        repo: repositoryName,
        pull_number: pullNumber,
        per_page: 100
      },
      { etag: cached?.etag ?? undefined }
    )

    // Skip processing on 304 Not Modified
    if (result.notModified) {
      console.log(`[syncFiles] No changes for PR #${pullNumber} (304)`)
      console.timeEnd('syncFiles')

      return
    }

    const filesData = result.data ?? []

    console.log(
      `Found ${filesData.length} modified files for PR #${pullNumber} in ${owner}/${repositoryName}.`
    )

    const database = getDatabase()
    const now = new Date().toISOString()

    const existingFiles = database
      .select()
      .from(modifiedFiles)
      .where(
        and(
          eq(modifiedFiles.pullRequestId, pullRequestId),
          isNull(modifiedFiles.deletedAt)
        )
      )
      .all()

    const syncedFilenames: string[] = []

    for (const fileData of filesData) {
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

      database
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
        .run()
    }

    for (const existingFile of existingFiles) {
      if (!syncedFilenames.includes(existingFile.filename)) {
        database
          .update(modifiedFiles)
          .set({ deletedAt: now })
          .where(eq(modifiedFiles.id, existingFile.id))
          .run()
      }
    }

    // Store the new ETag
    if (result.etag) {
      etagManager.set(etagKey, result.etag, result.lastModified ?? undefined)
    }

    console.timeEnd('syncFiles')
  } catch (error) {
    console.timeEnd('syncFiles')
    console.error('Error syncing pull request files:', error)

    throw error
  }
}
