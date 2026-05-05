import fs from 'node:fs'
import path from 'node:path'
import { simpleGit, SimpleGit } from 'simple-git'

export type CheckoutErrorCode =
  | 'dirty'
  | 'fetch-failed'
  | 'not-a-repo'
  | 'unknown'

export interface CheckoutResult {
  branch?: string
  code?: CheckoutErrorCode
  message?: string
  ok: boolean
  path?: string
}

export interface VerifyResult {
  ok: boolean
  reason?: string
}

export interface CloneResult {
  message?: string
  ok: boolean
  path?: string
}

function isGitRepo(localPath: string): boolean {
  return fs.existsSync(path.join(localPath, '.git'))
}

function originMatches(originUrl: string, fullName: string): boolean {
  const trimmed = originUrl.trim().toLowerCase()
  const target = fullName.toLowerCase()

  const patterns = [
    `git@github.com:${target}.git`,
    `git@github.com:${target}`,
    `https://github.com/${target}.git`,
    `https://github.com/${target}`,
    `ssh://git@github.com/${target}.git`,
    `ssh://git@github.com/${target}`
  ]

  return patterns.some((pattern) => trimmed === pattern)
}

export async function verifyRepo(
  localPath: string,
  fullName: string
): Promise<VerifyResult> {
  if (!fs.existsSync(localPath)) {
    return { ok: false, reason: 'Folder does not exist.' }
  }

  if (!isGitRepo(localPath)) {
    return { ok: false, reason: 'Folder is not a git repository.' }
  }

  const git = simpleGit(localPath)

  try {
    const originUrl = await git.remote(['get-url', 'origin'])

    if (typeof originUrl !== 'string' || originUrl.length === 0) {
      return { ok: false, reason: 'Repository has no origin remote.' }
    }

    if (!originMatches(originUrl, fullName)) {
      return {
        ok: false,
        reason: `Origin remote points at "${originUrl.trim()}", not "${fullName}".`
      }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return { ok: false, reason: `Failed to read git remote: ${message}` }
  }
}

interface CloneOptions {
  fullName: string
  parentDir: string
  token?: string | null
}

export async function cloneRepo({
  fullName,
  parentDir,
  token
}: CloneOptions): Promise<CloneResult> {
  if (!fs.existsSync(parentDir)) {
    return { ok: false, message: `Parent folder does not exist: ${parentDir}.` }
  }

  const repoName = fullName.split('/')[1]

  if (!repoName) {
    return { ok: false, message: `Invalid repository name: ${fullName}.` }
  }

  const targetPath = path.join(parentDir, repoName)

  if (fs.existsSync(targetPath)) {
    const verification = await verifyRepo(targetPath, fullName)

    if (verification.ok) {
      return { ok: true, path: targetPath }
    }

    return {
      ok: false,
      message: `Folder "${targetPath}" already exists and is not a clone of ${fullName}.`
    }
  }

  const cloneUrl = token
    ? `https://${token}@github.com/${fullName}.git`
    : `https://github.com/${fullName}.git`

  const git = simpleGit(parentDir)

  try {
    await git.clone(cloneUrl, targetPath)

    return { ok: true, path: targetPath }
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Unknown error'

    // Strip the token from any error messages so it isn't surfaced to the UI.
    const message = token ? raw.replaceAll(token, '***') : raw

    return { ok: false, message: `Failed to clone: ${message}` }
  }
}

interface CheckoutOptions {
  headRefName: string | null
  localPath: string
  pullNumber: number
}

async function isWorkingTreeDirty(git: SimpleGit): Promise<boolean> {
  const status = await git.status()

  return !status.isClean()
}

export async function checkoutPullRequestBranch({
  headRefName,
  localPath,
  pullNumber
}: CheckoutOptions): Promise<CheckoutResult> {
  if (!isGitRepo(localPath)) {
    return {
      code: 'not-a-repo',
      message: `"${localPath}" is no longer a git repository.`,
      ok: false
    }
  }

  const git = simpleGit(localPath)
  const localBranch = headRefName ?? `pr-${pullNumber}`
  const remoteRef = `pull/${pullNumber}/head`

  try {
    if (await isWorkingTreeDirty(git)) {
      return {
        code: 'dirty',
        message:
          'Working tree has uncommitted changes. Commit or stash them before checking out a different branch.',
        ok: false
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return { code: 'unknown', message, ok: false }
  }

  try {
    await git.fetch('origin', remoteRef)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return {
      code: 'fetch-failed',
      message: `Failed to fetch ${remoteRef} from origin: ${message}`,
      ok: false
    }
  }

  try {
    await git.checkout(['-B', localBranch, 'FETCH_HEAD'])

    return { branch: localBranch, ok: true, path: localPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return {
      code: 'unknown',
      message: `Failed to check out ${localBranch}: ${message}`,
      ok: false
    }
  }
}
