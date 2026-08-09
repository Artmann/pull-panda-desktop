import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pullRequests } from '../src/database/schema'
import {
  buildRepoConditions,
  formatState,
  parseArgs,
  redactNoisy
} from './inspect-pr'

const exitError = new Error('process.exit called')

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw exitError
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseArgs', () => {
  it('parses a bare PR number', () => {
    expect(parseArgs(['42'])).toEqual({ brief: false, number: 42, repo: null })
  })

  it('parses the --brief flag', () => {
    expect(parseArgs(['42', '--brief'])).toEqual({
      brief: true,
      number: 42,
      repo: null
    })
  })

  it('parses the --repo option', () => {
    expect(parseArgs(['42', '--repo', 'octocat/hello-world'])).toEqual({
      brief: false,
      number: 42,
      repo: 'octocat/hello-world'
    })
  })

  it('accepts options before the PR number', () => {
    expect(
      parseArgs(['--brief', '--repo', 'octocat/hello-world', '7'])
    ).toEqual({ brief: true, number: 7, repo: 'octocat/hello-world' })
  })

  it('exits when no PR number is given', () => {
    expect(() => parseArgs([])).toThrow(exitError)
  })

  it('exits on an invalid PR number', () => {
    expect(() => parseArgs(['abc'])).toThrow(exitError)
    expect(console.error).toHaveBeenCalledWith(
      '\x1b[31mError: "abc" is not a valid PR number.\x1b[0m'
    )
  })

  it('exits on a non-positive PR number', () => {
    expect(() => parseArgs(['0'])).toThrow(exitError)
  })

  it('exits when --repo is missing a value', () => {
    expect(() => parseArgs(['42', '--repo'])).toThrow(exitError)
    expect(console.error).toHaveBeenCalledWith(
      '\x1b[31mError: --repo requires a value in owner/name format.\x1b[0m'
    )
  })

  it('exits when --repo is not in owner/name format', () => {
    expect(() => parseArgs(['42', '--repo', 'octocat'])).toThrow(exitError)
  })

  it('exits on an unknown option', () => {
    expect(() => parseArgs(['42', '--bogus'])).toThrow(exitError)
    expect(console.error).toHaveBeenCalledWith(
      '\x1b[31mError: Unknown option "--bogus".\x1b[0m'
    )
  })
})

describe('formatState', () => {
  it('colors each known state and preserves the original casing', () => {
    expect(formatState('MERGED')).toEqual('\x1b[35mMERGED\x1b[0m')
    expect(formatState('closed')).toEqual('\x1b[31mclosed\x1b[0m')
    expect(formatState('OPEN')).toEqual('\x1b[32mOPEN\x1b[0m')
  })

  it('colors unknown states yellow', () => {
    expect(formatState('DRAFT')).toEqual('\x1b[33mDRAFT\x1b[0m')
  })
})

describe('redactNoisy', () => {
  it('replaces noisy string fields with a length placeholder', () => {
    expect(redactNoisy('bodyHtml', '<p>hello</p>')).toEqual('[12 chars]')
    expect(redactNoisy('diff_hunk', 'abc')).toEqual('[3 chars]')
  })

  it('keeps non-noisy fields unchanged', () => {
    expect(redactNoisy('title', 'Fix the bug')).toEqual('Fix the bug')
  })

  it('keeps noisy fields with non-string values unchanged', () => {
    expect(redactNoisy('bodyHtml', null)).toEqual(null)
    expect(redactNoisy('diffHunk', 42)).toEqual(42)
  })
})

describe('buildRepoConditions', () => {
  it('returns no conditions when repo is null', () => {
    expect(buildRepoConditions(null)).toEqual([])
  })

  it('returns owner and name conditions for owner/name', () => {
    expect(buildRepoConditions('octocat/hello-world')).toEqual([
      eq(pullRequests.repositoryOwner, 'octocat'),
      eq(pullRequests.repositoryName, 'hello-world')
    ])
  })
})
