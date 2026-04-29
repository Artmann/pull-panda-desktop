import { describe, expect, it } from 'vitest'

import { isBotAuthor } from './bot-detection'

describe('isBotAuthor', () => {
  it('returns false for null', () => {
    expect(isBotAuthor(null)).toEqual(false)
  })

  it('returns false for undefined', () => {
    expect(isBotAuthor(undefined)).toEqual(false)
  })

  it('returns false for an empty string', () => {
    expect(isBotAuthor('')).toEqual(false)
  })

  it('returns true for a [bot] suffix', () => {
    expect(isBotAuthor('renovate[bot]')).toEqual(true)
  })

  it('returns true for a [bot] suffix in any case', () => {
    expect(isBotAuthor('SomeOne[Bot]')).toEqual(true)
  })

  it.each([
    'claude',
    'codecov',
    'codecov-commenter',
    'coderabbit',
    'coderabbitai',
    'copilot',
    'dependabot',
    'github-actions',
    'panda',
    'pull-panda',
    'renovate',
    'sonarqubecloud',
    'vercel'
  ])('returns true for known bot login %s', (login) => {
    expect(isBotAuthor(login)).toEqual(true)
  })

  it('returns true for known bot logins regardless of case', () => {
    expect(isBotAuthor('Dependabot')).toEqual(true)
    expect(isBotAuthor('COPILOT')).toEqual(true)
    expect(isBotAuthor('GitHub-Actions')).toEqual(true)
  })

  it('returns false for an unknown human login', () => {
    expect(isBotAuthor('alice')).toEqual(false)
  })

  it('returns false for a login that contains "bot" but lacks the suffix', () => {
    expect(isBotAuthor('robotech')).toEqual(false)
  })
})
