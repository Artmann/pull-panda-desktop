import { describe, expect, it } from 'vitest'

import { pullRequestPath } from './pull-request-path'

describe('pullRequestPath', () => {
  it('carries the tab when there is one', () => {
    expect(pullRequestPath('pr-1', 'files')).toEqual(
      '/pull-requests/pr-1?tab=files'
    )
  })

  it('leaves the tab off when there is none', () => {
    expect(pullRequestPath('pr-1')).toEqual('/pull-requests/pr-1')
    expect(pullRequestPath('pr-1', null)).toEqual('/pull-requests/pr-1')
    expect(pullRequestPath('pr-1', '')).toEqual('/pull-requests/pr-1')
  })
})
