import { Octokit } from '@octokit/rest'

import { MemoryCache } from './memory-cache'

export interface CodeownerRule {
  pattern: string
  owners: string[]
}

export interface CodeownerMatch {
  login: string
  patterns: string[]
}

const rulesCache = new MemoryCache<CodeownerRule[]>()
const cacheTtl = 10 * 60 * 1000

const candidatePaths = [
  '.github/CODEOWNERS',
  'CODEOWNERS',
  'docs/CODEOWNERS'
]

interface GitHubContentResponse {
  content?: string
  encoding?: string
}

async function fetchCodeownersFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const response = await octokit.rest.repos.getContent({ owner, repo, path })
    const data = response.data as GitHubContentResponse

    if (!data.content || data.encoding !== 'base64') {
      return null
    }

    return Buffer.from(data.content, 'base64').toString('utf-8')
  } catch (error) {
    if (
      error instanceof Error &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      return null
    }

    throw error
  }
}

export function parseCodeowners(text: string): CodeownerRule[] {
  const rules: CodeownerRule[] = []
  const lines = text.split('\n')

  for (const raw of lines) {
    const withoutComment = raw.split('#')[0].trim()

    if (!withoutComment) {
      continue
    }

    const tokens = withoutComment.split(/\s+/)

    if (tokens.length < 2) {
      continue
    }

    const [pattern, ...rawOwners] = tokens
    const owners = rawOwners
      .filter((token) => token.startsWith('@'))
      .map((token) => token.slice(1))

    if (owners.length === 0) {
      continue
    }

    rules.push({ pattern, owners })
  }

  return rules
}

export async function fetchCodeownerRules(
  token: string,
  owner: string,
  repo: string
): Promise<CodeownerRule[]> {
  const cacheKey = `${owner}/${repo}`
  const cached = rulesCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const octokit = new Octokit({ auth: token })

  for (const path of candidatePaths) {
    const text = await fetchCodeownersFile(octokit, owner, repo, path)

    if (text !== null) {
      const rules = parseCodeowners(text)

      rulesCache.set(cacheKey, rules, cacheTtl)

      return rules
    }
  }

  rulesCache.set(cacheKey, [], cacheTtl)

  return []
}

function patternToRegex(pattern: string): RegExp {
  let normalized = pattern

  // Strip leading slash; CODEOWNERS treats `/foo` as repo-root anchored.
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1)
  }

  // A trailing slash means "this directory and everything inside".
  const matchesDirContents = normalized.endsWith('/')

  if (matchesDirContents) {
    normalized = normalized.slice(0, -1)
  }

  const escaped = normalized
    .split('/')
    .map((segment) => {
      if (segment === '**') {
        return '__DOUBLE_STAR__'
      }

      return segment
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
    })
    .join('/')
    .replace(/__DOUBLE_STAR__\//g, '(.*/)?')
    .replace(/\/__DOUBLE_STAR__/g, '(/.*)?')
    .replace(/__DOUBLE_STAR__/g, '.*')

  // No-slash pattern matches files at any depth (gitignore semantics).
  const hasSlash = normalized.includes('/')
  const prefix = hasSlash ? '^' : '(^|.*/)'
  const suffix = matchesDirContents ? '(/.*)?$' : '$'

  return new RegExp(`${prefix}${escaped}${suffix}`)
}

function ruleMatchesPath(rule: CodeownerRule, path: string): boolean {
  return patternToRegex(rule.pattern).test(path)
}

export function matchOwners(
  rules: CodeownerRule[],
  changedPaths: string[]
): CodeownerMatch[] {
  const matches = new Map<string, Set<string>>()

  for (const path of changedPaths) {
    // Last matching rule wins per CODEOWNERS spec.
    let lastMatch: CodeownerRule | null = null

    for (const rule of rules) {
      if (ruleMatchesPath(rule, path)) {
        lastMatch = rule
      }
    }

    if (!lastMatch) {
      continue
    }

    for (const owner of lastMatch.owners) {
      const set = matches.get(owner) ?? new Set<string>()
      set.add(lastMatch.pattern)
      matches.set(owner, set)
    }
  }

  return Array.from(matches.entries()).map(([login, patterns]) => ({
    login,
    patterns: Array.from(patterns)
  }))
}
