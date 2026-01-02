import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'

import { setupTestDatabase, teardownTestDatabase, mockFilesResponse } from './test-helpers'
import { getDatabase } from '../database'
import { modifiedFiles } from '../database/schema'
import { syncFiles } from './syncFiles'

const mockListFiles = vi.fn()

vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    rest = {
      pulls: {
        listFiles: mockListFiles
      }
    }
  }
}))

describe('syncFiles', () => {
  beforeEach(() => {
    setupTestDatabase()
    mockListFiles.mockReset()
    mockListFiles.mockResolvedValue(mockFilesResponse)
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

    expect(mockListFiles).toHaveBeenCalledWith({
      owner: 'testowner',
      repo: 'testrepo',
      pull_number: 1,
      per_page: 100
    })

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
        and(eq(modifiedFiles.pullRequestId, 'pr-123'), isNull(modifiedFiles.deletedAt))
      )

    expect(activeFiles).toHaveLength(3)
  })

  it('should handle empty files response', async () => {
    mockListFiles.mockResolvedValue({ data: [] })

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
    mockListFiles.mockRejectedValue(new Error('API error'))

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
})
