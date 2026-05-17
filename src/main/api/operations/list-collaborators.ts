import { Octokit } from '@octokit/rest'
import { Effect } from 'effect'

import { MemoryCache } from '../../memory-cache'
import { OctokitError } from '../errors'

export interface Collaborator {
  readonly avatarUrl: string
  readonly login: string
}

const cacheTtl = 10 * 60 * 1000
const cache = new MemoryCache<Collaborator[]>()

export const listCollaborators = (input: {
  readonly owner: string
  readonly repo: string
  readonly token: string
}): Effect.Effect<
  { readonly collaborators: ReadonlyArray<Collaborator> },
  OctokitError
> =>
  Effect.tryPromise({
    try: async () => {
      const cacheKey = `${input.owner}/${input.repo}`
      const cached = cache.get(cacheKey)

      if (cached) {
        return { collaborators: cached }
      }

      const octokit = new Octokit({ auth: input.token })
      const collaborators: Collaborator[] = []

      for (let page = 1; page <= 2; page++) {
        const response = await octokit.rest.repos.listCollaborators({
          owner: input.owner,
          page,
          per_page: 100,
          repo: input.repo
        })

        for (const user of response.data) {
          collaborators.push({
            avatarUrl: user.avatar_url,
            login: user.login
          })
        }

        if (response.data.length < 100) {
          break
        }
      }

      collaborators.sort((a, b) => a.login.localeCompare(b.login))

      cache.set(cacheKey, collaborators, cacheTtl)

      return { collaborators }
    },
    catch: (cause) => {
      const status =
        typeof cause === 'object' &&
        cause !== null &&
        'status' in cause &&
        typeof (cause as { status: unknown }).status === 'number'
          ? (cause as { status: number }).status
          : 500
      const message =
        cause instanceof Error ? cause.message : 'Failed to load collaborators'

      return new OctokitError({
        operation: `listCollaborators ${input.owner}/${input.repo}`,
        status,
        message
      })
    }
  })
