import { describe, expect, it } from 'vitest'

import { extractPullRequestId, getCommandView } from './context'

describe('getCommandView', () => {
  it('returns pr-detail for pull request paths', () => {
    expect(getCommandView('/pull-requests/abc123')).toEqual('pr-detail')
  })

  it('returns home for the root path', () => {
    expect(getCommandView('/')).toEqual('home')
  })

  it('returns other for any other path', () => {
    expect(getCommandView('/settings')).toEqual('other')
  })
})

describe('extractPullRequestId', () => {
  it('returns the id from a pull request path', () => {
    expect(extractPullRequestId('/pull-requests/abc123/files')).toEqual(
      'abc123'
    )
  })

  it('returns undefined for other paths', () => {
    expect(extractPullRequestId('/settings')).toEqual(undefined)
  })
})
