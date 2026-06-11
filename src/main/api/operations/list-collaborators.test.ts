import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listCollaborators } from './list-collaborators'

const octokitMocks = vi.hoisted(() => ({
  listCollaborators: vi.fn()
}))

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    rest = {
      repos: { listCollaborators: octokitMocks.listCollaborators }
    }
  }
}))

const makeUser = (login: string) => ({
  avatar_url: `https://example.com/${login}.png`,
  login
})

// The module keeps a shared in-memory cache keyed by owner/repo, so every
// test uses its own repo name to stay isolated.
const makeInput = (repo: string) => ({
  owner: 'octocat',
  repo,
  token: 'token_123'
})

describe('listCollaborators', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('maps and sorts collaborators from a single page', async () => {
    octokitMocks.listCollaborators.mockResolvedValue({
      data: [makeUser('zoe'), makeUser('amir')]
    })

    const result = await Effect.runPromise(
      listCollaborators(makeInput('single-page'))
    )

    expect(result).toEqual({
      collaborators: [
        { avatarUrl: 'https://example.com/amir.png', login: 'amir' },
        { avatarUrl: 'https://example.com/zoe.png', login: 'zoe' }
      ]
    })
    expect(octokitMocks.listCollaborators).toHaveBeenCalledTimes(1)
    expect(octokitMocks.listCollaborators).toHaveBeenCalledWith({
      owner: 'octocat',
      page: 1,
      per_page: 100,
      repo: 'single-page'
    })
  })

  it('fetches a second page when the first page is full', async () => {
    const firstPage = Array.from({ length: 100 }, (unused, index) =>
      makeUser(`user-${String(index).padStart(3, '0')}`)
    )

    octokitMocks.listCollaborators
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: [makeUser('user-100')] })

    const result = await Effect.runPromise(
      listCollaborators(makeInput('two-pages'))
    )

    expect(result.collaborators).toHaveLength(101)
    expect(octokitMocks.listCollaborators).toHaveBeenCalledTimes(2)
    expect(octokitMocks.listCollaborators).toHaveBeenLastCalledWith({
      owner: 'octocat',
      page: 2,
      per_page: 100,
      repo: 'two-pages'
    })
  })

  it('serves repeated requests from the cache without calling GitHub again', async () => {
    octokitMocks.listCollaborators.mockResolvedValue({
      data: [makeUser('amir')]
    })

    const first = await Effect.runPromise(
      listCollaborators(makeInput('cached'))
    )
    const second = await Effect.runPromise(
      listCollaborators(makeInput('cached'))
    )

    expect(second).toEqual(first)
    expect(octokitMocks.listCollaborators).toHaveBeenCalledTimes(1)
  })

  it('classifies failures that carry a status as an OctokitError with that status', async () => {
    octokitMocks.listCollaborators.mockRejectedValue(
      Object.assign(new Error('Not Found'), { status: 404 })
    )

    const error = await Effect.runPromise(
      Effect.flip(listCollaborators(makeInput('missing')))
    )

    expect({
      message: error.message,
      operation: error.operation,
      status: error.status,
      tag: error._tag
    }).toEqual({
      message: 'Not Found',
      operation: 'listCollaborators octocat/missing',
      status: 404,
      tag: 'OctokitError'
    })
  })

  it('falls back to status 500 and a generic message for non-Error failures', async () => {
    octokitMocks.listCollaborators.mockRejectedValue('boom')

    const error = await Effect.runPromise(
      Effect.flip(listCollaborators(makeInput('broken')))
    )

    expect({
      message: error.message,
      operation: error.operation,
      status: error.status,
      tag: error._tag
    }).toEqual({
      message: 'Failed to load collaborators',
      operation: 'listCollaborators octocat/broken',
      status: 500,
      tag: 'OctokitError'
    })
  })

  it('uses the error message even when the status is not a number', async () => {
    octokitMocks.listCollaborators.mockRejectedValue(
      Object.assign(new Error('Weird failure'), { status: 'nope' })
    )

    const error = await Effect.runPromise(
      Effect.flip(listCollaborators(makeInput('weird')))
    )

    expect({
      message: error.message,
      status: error.status
    }).toEqual({
      message: 'Weird failure',
      status: 500
    })
  })
})
