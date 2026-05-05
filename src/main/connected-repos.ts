import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export type ConnectedRepos = Record<string, string>

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'connected-repos.json')
}

export function loadAll(): ConnectedRepos {
  const storePath = getStorePath()

  if (!fs.existsSync(storePath)) {
    return {}
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const result: ConnectedRepos = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.length > 0) {
        result[key] = value
      }
    }

    return result
  } catch {
    return {}
  }
}

function saveAll(repos: ConnectedRepos): void {
  const storePath = getStorePath()

  fs.writeFileSync(storePath, JSON.stringify(repos, null, 2), 'utf-8')
}

export function getRepoPath(fullName: string): string | null {
  const repos = loadAll()

  return repos[fullName] ?? null
}

export function setRepoPath(fullName: string, localPath: string): void {
  const repos = loadAll()
  repos[fullName] = localPath
  saveAll(repos)
}

export function removeRepoPath(fullName: string): void {
  const repos = loadAll()
  delete repos[fullName]
  saveAll(repos)
}
