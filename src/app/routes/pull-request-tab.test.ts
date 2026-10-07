import { describe, expect, it } from 'vitest'

import { getActiveTab } from './pull-request-tab'

describe('getActiveTab', () => {
  it('returns the tab from the URL when it is valid', () => {
    expect(getActiveTab('files')).toEqual('files')
    expect(getActiveTab('tasks')).toEqual('tasks')
  })

  it('falls back to overview when the tab is missing', () => {
    expect(getActiveTab(null)).toEqual('overview')
    expect(getActiveTab('')).toEqual('overview')
  })

  it('falls back to overview when the tab is unknown', () => {
    expect(getActiveTab('commits')).toEqual('overview')
  })
})
