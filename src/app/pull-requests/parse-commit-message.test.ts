import { describe, expect, it } from 'vitest'

import { parseCommitMessage } from './parse-commit-message'

describe('parseCommitMessage', () => {
  it('returns a placeholder for a missing message', () => {
    expect(parseCommitMessage(null)).toEqual({
      body: null,
      title: 'No message'
    })
  })

  it('returns a placeholder for an empty message', () => {
    expect(parseCommitMessage('')).toEqual({ body: null, title: 'No message' })
  })

  it('reads a subject-only message', () => {
    expect(parseCommitMessage('Reserve the mono face for code')).toEqual({
      body: null,
      title: 'Reserve the mono face for code'
    })
  })

  it('splits a subject from its body', () => {
    expect(
      parseCommitMessage('Fix the merge button\n\nIt was washed out.')
    ).toEqual({
      body: 'It was washed out.',
      title: 'Fix the merge button'
    })
  })

  it('drops the blank lines that separate body paragraphs', () => {
    expect(
      parseCommitMessage('Subject\n\nFirst paragraph.\n\nSecond paragraph.')
    ).toEqual({
      body: 'First paragraph.\nSecond paragraph.',
      title: 'Subject'
    })
  })

  it('keeps a body that follows the subject with no blank line', () => {
    expect(parseCommitMessage('Subject\nRun-on body.')).toEqual({
      body: 'Run-on body.',
      title: 'Subject'
    })
  })

  it('keeps backticks in the subject for the caller to render', () => {
    expect(parseCommitMessage('Turn on `yarn lint` in CI')).toEqual({
      body: null,
      title: 'Turn on `yarn lint` in CI'
    })
  })
})
