import { Octokit } from '@octokit/rest'
import { Hono } from 'hono'
import { and, eq, isNull } from 'drizzle-orm'

import { getDatabase } from '../../../database'
import { modifiedFiles, pullRequests } from '../../../database/schema'
import { fetchCodeownerRules, matchOwners } from '../../codeowners'
import { MemoryCache } from '../../memory-cache'

import type { AppEnv } from './comments'

export interface Collaborator {
  avatarUrl: string
  login: string
}

const collaboratorsCacheTtl = 10 * 60 * 1000
const collaboratorsCache = new MemoryCache<Collaborator[]>()

async function loadCollaborators(
  token: string,
  owner: string,
  repo: string
): Promise<Collaborator[]> {
  const cacheKey = `${owner}/${repo}`
  const cached = collaboratorsCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const octokit = new Octokit({ auth: token })
  const collaborators: Collaborator[] = []

  // Up to 200 collaborators (two pages of 100).
  for (let page = 1; page <= 2; page++) {
    const response = await octokit.rest.repos.listCollaborators({
      owner,
      repo,
      per_page: 100,
      page
    })

    for (const user of response.data) {
      collaborators.push({
        login: user.login,
        avatarUrl: user.avatar_url
      })
    }

    if (response.data.length < 100) {
      break
    }
  }

  collaborators.sort((a, b) => a.login.localeCompare(b.login))

  collaboratorsCache.set(cacheKey, collaborators, collaboratorsCacheTtl)

  return collaborators
}

export const reposRoute = new Hono<AppEnv>()

reposRoute.get('/:owner/:name/collaborators', async (context) => {
  const token = context.get('token')
  const owner = context.req.param('owner')
  const name = context.req.param('name')

  if (!owner || !name) {
    return context.json({ error: 'Missing repository identifier' }, 400)
  }

  try {
    const collaborators = await loadCollaborators(token, owner, name)

    return context.json({ collaborators })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to load collaborators:', error)

    return context.json({ error: message }, 500)
  }
})

reposRoute.get('/:owner/:name/codeowners', async (context) => {
  const token = context.get('token')
  const owner = context.req.param('owner')
  const name = context.req.param('name')
  const pullRequestId = context.req.query('pullRequestId')

  if (!owner || !name) {
    return context.json({ error: 'Missing repository identifier' }, 400)
  }

  try {
    const rules = await fetchCodeownerRules(token, owner, name)

    if (!pullRequestId) {
      return context.json({ owners: [] })
    }

    const database = getDatabase()

    const pullRequest = database
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.id, pullRequestId))
      .get()

    if (!pullRequest) {
      return context.json({ error: 'Pull request not found' }, 404)
    }

    const files = database
      .select({ filePath: modifiedFiles.filePath })
      .from(modifiedFiles)
      .where(
        and(
          eq(modifiedFiles.pullRequestId, pullRequestId),
          isNull(modifiedFiles.deletedAt)
        )
      )
      .all()

    const owners = matchOwners(
      rules,
      files.map((file) => file.filePath)
    )

    return context.json({ owners })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to load codeowners:', error)

    return context.json({ error: message }, 500)
  }
})
