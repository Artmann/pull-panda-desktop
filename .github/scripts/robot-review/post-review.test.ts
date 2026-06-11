import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { filterIssuesInDiff, parseReviewContent } from './post-review'
import type { Issue, Review } from './types'

const review: Review = {
  issues: [
    {
      description: 'Desc',
      file: 'src/app.ts',
      line: 10,
      severity: 'critical',
      title: 'Missing null check'
    }
  ],
  summary: 'Found one issue.'
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseReviewContent', () => {
  it('parses a bare review object', () => {
    expect(parseReviewContent(JSON.stringify(review))).toEqual(review)
  })

  it('unwraps the opencode response envelope', () => {
    const envelope = JSON.stringify({ response: JSON.stringify(review) })

    expect(parseReviewContent(envelope)).toEqual(review)
  })

  it('strips markdown code fences from the wrapped response', () => {
    const fenced = '```json\n' + JSON.stringify(review) + '\n```'
    const envelope = JSON.stringify({ response: fenced })

    expect(parseReviewContent(envelope)).toEqual(review)
  })

  it('strips bare code fences without a language tag', () => {
    const fenced = '```\n' + JSON.stringify(review) + '\n```'
    const envelope = JSON.stringify({ response: fenced })

    expect(parseReviewContent(envelope)).toEqual(review)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseReviewContent('not json')).toThrow()
  })

  it('throws when the unwrapped response is not JSON', () => {
    const envelope = JSON.stringify({ response: 'plain prose, no JSON' })

    expect(() => parseReviewContent(envelope)).toThrow()
  })
})

describe('filterIssuesInDiff', () => {
  const makeIssue = (file: string): Issue => ({
    description: 'Desc',
    file,
    line: 1,
    severity: 'minor',
    title: 'Title'
  })

  it('keeps issues on files in the diff and drops the rest', () => {
    const inDiff = makeIssue('src/app.ts')
    const outsideDiff = makeIssue('src/other.ts')
    const validPaths = new Set(['src/app.ts'])

    expect(filterIssuesInDiff([inDiff, outsideDiff], validPaths)).toEqual([
      inDiff
    ])
  })

  it('warns for each skipped issue', () => {
    filterIssuesInDiff([makeIssue('src/missing.ts')], new Set())

    expect(console.warn).toHaveBeenCalledWith(
      'Skipping issue on "src/missing.ts" — not in PR diff.'
    )
  })

  it('returns an empty array for no issues', () => {
    expect(filterIssuesInDiff([], new Set(['src/app.ts']))).toEqual([])
  })
})
