import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkoutPullRequestBranch, cloneRepo, verifyRepo } from './git'

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn()
}))

const gitMocks = vi.hoisted(() => ({
  checkout: vi.fn(),
  clone: vi.fn(),
  fetch: vi.fn(),
  remote: vi.fn(),
  simpleGit: vi.fn(),
  status: vi.fn()
}))

vi.mock('node:fs', () => ({
  default: { existsSync: fsMocks.existsSync }
}))

vi.mock('simple-git', () => ({
  simpleGit: gitMocks.simpleGit
}))

const repoPath = path.join('home', 'projects', 'demo')
const gitDirPath = path.join(repoPath, '.git')

// Makes `existsSync` answer true only for the given paths.
const existingPaths = (paths: string[]) => {
  fsMocks.existsSync.mockImplementation((candidate: string) =>
    paths.includes(candidate)
  )
}

describe('verifyRepo', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    gitMocks.simpleGit.mockReturnValue({
      checkout: gitMocks.checkout,
      clone: gitMocks.clone,
      fetch: gitMocks.fetch,
      remote: gitMocks.remote,
      status: gitMocks.status
    })
  })

  it('fails when the folder does not exist', async () => {
    existingPaths([])

    const result = await verifyRepo(repoPath, 'octocat/demo')

    expect(result).toEqual({ ok: false, reason: 'Folder does not exist.' })
    expect(gitMocks.simpleGit).not.toHaveBeenCalled()
  })

  it('fails when the folder is not a git repository', async () => {
    existingPaths([repoPath])

    const result = await verifyRepo(repoPath, 'octocat/demo')

    expect(result).toEqual({
      ok: false,
      reason: 'Folder is not a git repository.'
    })
  })

  it('fails when the repository has no origin remote', async () => {
    existingPaths([repoPath, gitDirPath])
    gitMocks.remote.mockResolvedValue('')

    const result = await verifyRepo(repoPath, 'octocat/demo')

    expect(result).toEqual({
      ok: false,
      reason: 'Repository has no origin remote.'
    })
    expect(gitMocks.remote).toHaveBeenCalledWith(['get-url', 'origin'])
  })

  it('fails when the origin remote points at a different repository', async () => {
    existingPaths([repoPath, gitDirPath])
    gitMocks.remote.mockResolvedValue('git@github.com:someone/else.git\n')

    const result = await verifyRepo(repoPath, 'octocat/demo')

    expect(result).toEqual({
      ok: false,
      reason:
        'Origin remote points at "git@github.com:someone/else.git", not "octocat/demo".'
    })
  })

  it.each([
    'git@github.com:octocat/demo.git',
    'git@github.com:Octocat/Demo',
    'https://github.com/octocat/demo.git',
    'https://github.com/octocat/demo',
    'ssh://git@github.com/octocat/demo.git'
  ])('passes when the origin remote is %s', async (originUrl) => {
    existingPaths([repoPath, gitDirPath])
    gitMocks.remote.mockResolvedValue(`${originUrl}\n`)

    const result = await verifyRepo(repoPath, 'octocat/demo')

    expect(result).toEqual({ ok: true })
  })

  it('reports the error message when reading the remote throws', async () => {
    existingPaths([repoPath, gitDirPath])
    gitMocks.remote.mockRejectedValue(new Error('not a git command'))

    const result = await verifyRepo(repoPath, 'octocat/demo')

    expect(result).toEqual({
      ok: false,
      reason: 'Failed to read git remote: not a git command'
    })
  })

  it('falls back to a generic reason for non-Error failures', async () => {
    existingPaths([repoPath, gitDirPath])
    gitMocks.remote.mockRejectedValue('boom')

    const result = await verifyRepo(repoPath, 'octocat/demo')

    expect(result).toEqual({
      ok: false,
      reason: 'Failed to read git remote: Unknown error'
    })
  })
})

describe('cloneRepo', () => {
  const parentDir = path.join('home', 'projects')
  const targetPath = path.join(parentDir, 'demo')

  beforeEach(() => {
    vi.resetAllMocks()

    gitMocks.simpleGit.mockReturnValue({
      checkout: gitMocks.checkout,
      clone: gitMocks.clone,
      fetch: gitMocks.fetch,
      remote: gitMocks.remote,
      status: gitMocks.status
    })
  })

  it('fails when the parent folder does not exist', async () => {
    existingPaths([])

    const result = await cloneRepo({ fullName: 'octocat/demo', parentDir })

    expect(result).toEqual({
      ok: false,
      message: `Parent folder does not exist: ${parentDir}.`
    })
  })

  it('fails when the full name has no repository part', async () => {
    existingPaths([parentDir])

    const result = await cloneRepo({ fullName: 'octocat', parentDir })

    expect(result).toEqual({
      ok: false,
      message: 'Invalid repository name: octocat.'
    })
  })

  it('reuses an existing folder that verifies as a clone of the repository', async () => {
    existingPaths([parentDir, targetPath, path.join(targetPath, '.git')])
    gitMocks.remote.mockResolvedValue('https://github.com/octocat/demo.git\n')

    const result = await cloneRepo({ fullName: 'octocat/demo', parentDir })

    expect(result).toEqual({ ok: true, path: targetPath })
    expect(gitMocks.clone).not.toHaveBeenCalled()
  })

  it('fails when the target folder exists but is not a clone of the repository', async () => {
    existingPaths([parentDir, targetPath, path.join(targetPath, '.git')])
    gitMocks.remote.mockResolvedValue('https://github.com/someone/else.git\n')

    const result = await cloneRepo({ fullName: 'octocat/demo', parentDir })

    expect(result).toEqual({
      ok: false,
      message: `Folder "${targetPath}" already exists and is not a clone of octocat/demo.`
    })
    expect(gitMocks.clone).not.toHaveBeenCalled()
  })

  it('clones anonymously when no token is given', async () => {
    existingPaths([parentDir])
    gitMocks.clone.mockResolvedValue(undefined)

    const result = await cloneRepo({ fullName: 'octocat/demo', parentDir })

    expect(result).toEqual({ ok: true, path: targetPath })
    expect(gitMocks.clone).toHaveBeenCalledWith(
      'https://github.com/octocat/demo.git',
      targetPath
    )
  })

  it('embeds the token in the clone url when given', async () => {
    existingPaths([parentDir])
    gitMocks.clone.mockResolvedValue(undefined)

    const result = await cloneRepo({
      fullName: 'octocat/demo',
      parentDir,
      token: 'secret-token'
    })

    expect(result).toEqual({ ok: true, path: targetPath })
    expect(gitMocks.clone).toHaveBeenCalledWith(
      'https://secret-token@github.com/octocat/demo.git',
      targetPath
    )
  })

  it('strips the token from clone error messages', async () => {
    existingPaths([parentDir])
    gitMocks.clone.mockRejectedValue(
      new Error(
        'fatal: unable to access https://secret-token@github.com/octocat/demo.git'
      )
    )

    const result = await cloneRepo({
      fullName: 'octocat/demo',
      parentDir,
      token: 'secret-token'
    })

    expect(result).toEqual({
      ok: false,
      message:
        'Failed to clone: fatal: unable to access https://***@github.com/octocat/demo.git'
    })
  })

  it('falls back to a generic message for non-Error clone failures', async () => {
    existingPaths([parentDir])
    gitMocks.clone.mockRejectedValue('boom')

    const result = await cloneRepo({ fullName: 'octocat/demo', parentDir })

    expect(result).toEqual({
      ok: false,
      message: 'Failed to clone: Unknown error'
    })
  })
})

describe('checkoutPullRequestBranch', () => {
  const options = {
    headRefName: 'feature-branch',
    localPath: repoPath,
    pullNumber: 42
  }

  beforeEach(() => {
    vi.resetAllMocks()

    gitMocks.simpleGit.mockReturnValue({
      checkout: gitMocks.checkout,
      clone: gitMocks.clone,
      fetch: gitMocks.fetch,
      remote: gitMocks.remote,
      status: gitMocks.status
    })

    existingPaths([repoPath, gitDirPath])
    gitMocks.status.mockResolvedValue({ isClean: () => true })
    gitMocks.fetch.mockResolvedValue(undefined)
    gitMocks.checkout.mockResolvedValue(undefined)
  })

  it('fails when the folder is no longer a git repository', async () => {
    existingPaths([repoPath])

    const result = await checkoutPullRequestBranch(options)

    expect(result).toEqual({
      code: 'not-a-repo',
      message: `"${repoPath}" is no longer a git repository.`,
      ok: false
    })
    expect(gitMocks.fetch).not.toHaveBeenCalled()
  })

  it('fails when the working tree has uncommitted changes', async () => {
    gitMocks.status.mockResolvedValue({ isClean: () => false })

    const result = await checkoutPullRequestBranch(options)

    expect(result).toEqual({
      code: 'dirty',
      message:
        'Working tree has uncommitted changes. Commit or stash them before checking out a different branch.',
      ok: false
    })
    expect(gitMocks.fetch).not.toHaveBeenCalled()
  })

  it('fails with the error message when reading the status throws', async () => {
    gitMocks.status.mockRejectedValue(new Error('index is locked'))

    const result = await checkoutPullRequestBranch(options)

    expect(result).toEqual({
      code: 'unknown',
      message: 'index is locked',
      ok: false
    })
  })

  it('fails when fetching the pull request ref fails', async () => {
    gitMocks.fetch.mockRejectedValue(new Error('could not resolve host'))

    const result = await checkoutPullRequestBranch(options)

    expect(result).toEqual({
      code: 'fetch-failed',
      message:
        'Failed to fetch pull/42/head from origin: could not resolve host',
      ok: false
    })
    expect(gitMocks.checkout).not.toHaveBeenCalled()
  })

  it('fails when checking out the fetched ref fails', async () => {
    gitMocks.checkout.mockRejectedValue(new Error('pathspec did not match'))

    const result = await checkoutPullRequestBranch(options)

    expect(result).toEqual({
      code: 'unknown',
      message: 'Failed to check out feature-branch: pathspec did not match',
      ok: false
    })
  })

  it('checks out the head ref branch from the fetched pull request head', async () => {
    const result = await checkoutPullRequestBranch(options)

    expect(result).toEqual({
      branch: 'feature-branch',
      ok: true,
      path: repoPath
    })
    expect(gitMocks.fetch).toHaveBeenCalledWith('origin', 'pull/42/head')
    expect(gitMocks.checkout).toHaveBeenCalledWith([
      '-B',
      'feature-branch',
      'FETCH_HEAD'
    ])
  })

  it('falls back to a pr-numbered branch when the head ref name is unknown', async () => {
    const result = await checkoutPullRequestBranch({
      ...options,
      headRefName: null
    })

    expect(result).toEqual({ branch: 'pr-42', ok: true, path: repoPath })
    expect(gitMocks.checkout).toHaveBeenCalledWith([
      '-B',
      'pr-42',
      'FETCH_HEAD'
    ])
  })
})
