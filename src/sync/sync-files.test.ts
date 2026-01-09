import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import {
  setupTestDatabase,
  teardownTestDatabase,
  mockFilesResponse
} from './test-helpers'
import { getDatabase } from '../database'
import { modifiedFiles } from '../database/schema'
import { syncFiles } from './sync-files'

const mockRequest = vi.fn()

vi.mock('./rest-client', () => ({
  createRestClient: () => ({
    request: mockRequest
  })
}))

describe('syncFiles', () => {
  beforeEach(async () => {
    await setupTestDatabase()
    mockRequest.mockReset()
    mockRequest.mockResolvedValue({
      data: mockFilesResponse.data,
      notModified: false,
      etag: 'mock-etag',
      lastModified: null
    })
  })

  afterEach(() => {
    teardownTestDatabase()
  })

  it('should sync files from GitHub REST API', async () => {
    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner: 'testowner',
        repo: 'testrepo',
        pull_number: 1,
        per_page: 100
      },
      { etag: undefined }
    )

    const db = getDatabase()
    const savedFiles = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.pullRequestId, 'pr-123'))

    expect(savedFiles).toHaveLength(3)
  })

  it('should store file metadata correctly', async () => {
    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedFiles = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.pullRequestId, 'pr-123'))

    const modifiedFile = savedFiles.find((f) => f.filename === 'src/index.ts')

    expect(modifiedFile?.status).toEqual('modified')
    expect(modifiedFile?.additions).toEqual(10)
    expect(modifiedFile?.deletions).toEqual(5)
    expect(modifiedFile?.changes).toEqual(15)
  })

  it('should handle added files', async () => {
    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedFiles = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.pullRequestId, 'pr-123'))

    const addedFile = savedFiles.find((f) => f.filename === 'src/new-file.ts')

    expect(addedFile?.status).toEqual('added')
    expect(addedFile?.additions).toEqual(50)
    expect(addedFile?.deletions).toEqual(0)
  })

  it('should handle removed files', async () => {
    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedFiles = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.pullRequestId, 'pr-123'))

    const removedFile = savedFiles.find((f) => f.filename === 'src/deleted.ts')

    expect(removedFile?.status).toEqual('removed')
    expect(removedFile?.additions).toEqual(0)
    expect(removedFile?.deletions).toEqual(30)
  })

  it('should store diff hunks (patches)', async () => {
    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedFiles = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.pullRequestId, 'pr-123'))

    const file = savedFiles.find((f) => f.filename === 'src/index.ts')

    expect(file?.diffHunk).toContain('@@ -1,5 +1,10 @@')
  })

  it('should soft delete files that no longer exist', async () => {
    const db = getDatabase()

    await db.insert(modifiedFiles).values({
      id: 'existing-1',
      pullRequestId: 'pr-123',
      filename: 'src/old-file.ts',
      filePath: 'src/old-file.ts',
      syncedAt: new Date().toISOString()
    })

    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const deletedFile = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.id, 'existing-1'))

    expect(deletedFile[0].deletedAt).not.toBeNull()

    const activeFiles = await db
      .select()
      .from(modifiedFiles)
      .where(
        and(
          eq(modifiedFiles.pullRequestId, 'pr-123'),
          isNull(modifiedFiles.deletedAt)
        )
      )

    expect(activeFiles).toHaveLength(3)
  })

  it('should handle empty files response', async () => {
    mockRequest.mockResolvedValueOnce({
      data: [],
      notModified: false,
      etag: 'mock-etag',
      lastModified: null
    })

    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    const db = getDatabase()
    const savedFiles = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.pullRequestId, 'pr-123'))

    expect(savedFiles).toHaveLength(0)
  })

  it('should throw on API errors', async () => {
    mockRequest.mockRejectedValueOnce(new Error('API error'))

    await expect(
      syncFiles({
        token: 'test-token',
        pullRequestId: 'pr-123',
        owner: 'testowner',
        repositoryName: 'testrepo',
        pullNumber: 1
      })
    ).rejects.toThrow('API error')
  })

  it('should skip processing on 304 Not Modified', async () => {
    mockRequest.mockResolvedValueOnce({
      data: null,
      notModified: true,
      etag: 'mock-etag',
      lastModified: null
    })

    const db = getDatabase()

    await db.insert(modifiedFiles).values({
      id: 'existing-1',
      pullRequestId: 'pr-123',
      filename: 'src/old-file.ts',
      filePath: 'src/old-file.ts',
      syncedAt: new Date().toISOString()
    })

    await syncFiles({
      token: 'test-token',
      pullRequestId: 'pr-123',
      owner: 'testowner',
      repositoryName: 'testrepo',
      pullNumber: 1
    })

    // File should not be deleted since we got 304
    const existingFile = await db
      .select()
      .from(modifiedFiles)
      .where(eq(modifiedFiles.id, 'existing-1'))

    expect(existingFile[0].deletedAt).toBeNull()
  })
})
