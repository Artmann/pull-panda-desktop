import { describe, expect, it } from 'vitest'

import { matchOwners, parseCodeowners } from './codeowners'

describe('parseCodeowners', () => {
  it('parses pattern and owners, ignoring comments and blank lines', () => {
    const text = `
# Top-level owners
* @octocat

# Frontend
web/* @alice @org/frontend-team

# Backend
api/  @bob
`

    expect(parseCodeowners(text)).toEqual([
      { pattern: '*', owners: ['octocat'] },
      { pattern: 'web/*', owners: ['alice', 'org/frontend-team'] },
      { pattern: 'api/', owners: ['bob'] }
    ])
  })

  it('skips lines without owners', () => {
    expect(parseCodeowners('foo/bar\n')).toEqual([])
  })
})

describe('matchOwners', () => {
  it('returns the last matching rule per file (CODEOWNERS spec)', () => {
    const rules = parseCodeowners(`
* @everyone
web/* @web-team
`)

    const owners = matchOwners(rules, ['web/index.tsx'])

    expect(owners).toEqual([{ login: 'web-team', patterns: ['web/*'] }])
  })

  it('treats trailing slash as the directory and everything inside', () => {
    const rules = parseCodeowners('api/ @backend-team')

    const owners = matchOwners(rules, [
      'api/users.ts',
      'api/internal/auth.ts'
    ])

    expect(owners).toEqual([
      { login: 'backend-team', patterns: ['api/'] }
    ])
  })

  it('matches filename-only patterns at any depth', () => {
    const rules = parseCodeowners('*.md @docs-team')

    const owners = matchOwners(rules, ['README.md', 'docs/guide.md'])

    expect(owners).toEqual([{ login: 'docs-team', patterns: ['*.md'] }])
  })

  it('returns no owner for unmatched files', () => {
    const rules = parseCodeowners('web/* @web-team')

    expect(matchOwners(rules, ['api/users.ts'])).toEqual([])
  })

  it('aggregates patterns when a single owner appears in multiple matched rules', () => {
    const rules = parseCodeowners(`
api/ @backend-team
db/  @backend-team
`)

    const owners = matchOwners(rules, ['api/users.ts', 'db/schema.ts'])

    expect(owners).toEqual([
      { login: 'backend-team', patterns: ['api/', 'db/'] }
    ])
  })
})
