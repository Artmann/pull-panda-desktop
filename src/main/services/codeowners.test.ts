import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CodeownerMatch, CodeownerRule } from '../codeowners'
import { Codeowners, CodeownersLive } from './codeowners'

const mocks = vi.hoisted(() => ({
  fetchCodeownerRules: vi.fn()
}))

vi.mock('../codeowners', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../codeowners')>()

  return { ...actual, fetchCodeownerRules: mocks.fetchCodeownerRules }
})

const fetchInput = { owner: 'octocat', repo: 'demo', token: 'token_123' }

const runFetchRules = () =>
  Effect.runPromise(
    Effect.provide(
      Effect.flatMap(Codeowners, (codeowners) =>
        codeowners.fetchRules(fetchInput)
      ),
      CodeownersLive
    )
  )

const runMatchOwners = (input: {
  changedPaths: ReadonlyArray<string>
  rules: ReadonlyArray<CodeownerRule>
}): Promise<ReadonlyArray<CodeownerMatch>> =>
  Effect.runPromise(
    Effect.provide(
      Effect.map(Codeowners, (codeowners) => codeowners.matchOwners(input)),
      CodeownersLive
    )
  )

describe('Codeowners service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('fetchRules', () => {
    it('returns the fetched rules', async () => {
      const rules: CodeownerRule[] = [{ owners: ['alice'], pattern: '/src/**' }]

      mocks.fetchCodeownerRules.mockResolvedValue(rules)

      const result = await runFetchRules()

      expect(result).toEqual(rules)
      expect(mocks.fetchCodeownerRules).toHaveBeenCalledWith(
        'token_123',
        'octocat',
        'demo'
      )
    })

    it('maps failures carrying a numeric status to an OctokitError with that status', async () => {
      mocks.fetchCodeownerRules.mockRejectedValue(
        Object.assign(new Error('Forbidden'), { status: 403 })
      )

      const error = await Effect.runPromise(
        Effect.provide(
          Effect.flip(
            Effect.flatMap(Codeowners, (codeowners) =>
              codeowners.fetchRules(fetchInput)
            )
          ),
          CodeownersLive
        )
      )

      expect({
        message: error.message,
        operation: error.operation,
        status: error.status,
        tag: error._tag
      }).toEqual({
        message: 'Forbidden',
        operation: 'codeowners octocat/demo',
        status: 403,
        tag: 'OctokitError'
      })
    })

    it('falls back to status 500 when the failure has a non-numeric status', async () => {
      mocks.fetchCodeownerRules.mockRejectedValue(
        Object.assign(new Error('weird failure'), { status: 'nope' })
      )

      const error = await Effect.runPromise(
        Effect.provide(
          Effect.flip(
            Effect.flatMap(Codeowners, (codeowners) =>
              codeowners.fetchRules(fetchInput)
            )
          ),
          CodeownersLive
        )
      )

      expect({ message: error.message, status: error.status }).toEqual({
        message: 'weird failure',
        status: 500
      })
    })

    it('falls back to status 500 and a generic message for non-Error failures', async () => {
      mocks.fetchCodeownerRules.mockRejectedValue('boom')

      const error = await Effect.runPromise(
        Effect.provide(
          Effect.flip(
            Effect.flatMap(Codeowners, (codeowners) =>
              codeowners.fetchRules(fetchInput)
            )
          ),
          CodeownersLive
        )
      )

      expect({
        message: error.message,
        operation: error.operation,
        status: error.status,
        tag: error._tag
      }).toEqual({
        message: 'Failed to fetch CODEOWNERS',
        operation: 'codeowners octocat/demo',
        status: 500,
        tag: 'OctokitError'
      })
    })
  })

  describe('matchOwners', () => {
    it('matches changed paths against the rules with last-match-wins semantics', async () => {
      const rules: CodeownerRule[] = [
        { owners: ['alice'], pattern: '*' },
        { owners: ['bob', 'carol'], pattern: '/src/app/**' },
        { owners: ['dave'], pattern: 'docs/' }
      ]

      const result = await runMatchOwners({
        changedPaths: [
          'README.md',
          'docs/guide.md',
          'src/app/App.tsx',
          'src/app/components/Button.tsx'
        ],
        rules
      })

      expect(result).toEqual([
        { login: 'alice', patterns: ['*'] },
        { login: 'dave', patterns: ['docs/'] },
        { login: 'bob', patterns: ['/src/app/**'] },
        { login: 'carol', patterns: ['/src/app/**'] }
      ])
    })

    it('returns no matches when no rule applies', async () => {
      const result = await runMatchOwners({
        changedPaths: ['src/index.ts'],
        rules: [{ owners: ['alice'], pattern: '/docs/**' }]
      })

      expect(result).toEqual([])
    })
  })
})
