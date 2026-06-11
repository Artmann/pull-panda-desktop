import { describe, expect, it } from 'vitest'

import { needsSync } from './needs-sync'

const now = new Date('2026-06-11T12:00:00Z').getTime()

const minuteMs = 60 * 1000
const hourMs = 60 * minuteMs
const dayMs = 24 * hourMs

interface CandidateOverrides {
  detailsSyncedAt?: string | null
  id?: string
  state?: string
  updatedAt?: string
}

function candidate(overrides: CandidateOverrides = {}) {
  return {
    detailsSyncedAt: new Date(now - 30 * 1000).toISOString(),
    id: 'pr-1',
    state: 'OPEN',
    updatedAt: new Date(now - hourMs).toISOString(),
    ...overrides
  }
}

const noActiveIds = new Set<string>()

describe('needsSync', () => {
  it('skips merged pull requests', () => {
    const pullRequest = candidate({ detailsSyncedAt: null, state: 'MERGED' })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(false)
  })

  it('skips closed pull requests', () => {
    const pullRequest = candidate({ detailsSyncedAt: null, state: 'CLOSED' })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(false)
  })

  it('syncs pull requests that have never been synced', () => {
    const pullRequest = candidate({ detailsSyncedAt: null })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(true)
  })

  it('syncs pull requests updated on GitHub since the last sync', () => {
    const pullRequest = candidate({
      detailsSyncedAt: new Date(now - 10 * minuteMs).toISOString(),
      updatedAt: new Date(now - 5 * minuteMs).toISOString()
    })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(true)
  })

  it('syncs active pull requests synced more than 10 seconds ago', () => {
    const pullRequest = candidate({
      detailsSyncedAt: new Date(now - 11 * 1000).toISOString()
    })

    expect(needsSync(pullRequest, new Set(['pr-1']), now)).toEqual(true)
  })

  it('skips active pull requests synced within the last 10 seconds', () => {
    const pullRequest = candidate({
      detailsSyncedAt: new Date(now - 5 * 1000).toISOString()
    })

    expect(needsSync(pullRequest, new Set(['pr-1']), now)).toEqual(false)
  })

  it('syncs recently updated pull requests synced over a minute ago', () => {
    const pullRequest = candidate({
      detailsSyncedAt: new Date(now - 2 * minuteMs).toISOString()
    })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(true)
  })

  it('skips recently updated pull requests synced within the last minute', () => {
    const pullRequest = candidate({
      detailsSyncedAt: new Date(now - 30 * 1000).toISOString()
    })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(false)
  })

  it('syncs older pull requests synced more than five minutes ago', () => {
    const pullRequest = candidate({
      detailsSyncedAt: new Date(now - 6 * minuteMs).toISOString(),
      updatedAt: new Date(now - 2 * dayMs).toISOString()
    })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(true)
  })

  it('skips older pull requests synced within the last five minutes', () => {
    const pullRequest = candidate({
      detailsSyncedAt: new Date(now - 4 * minuteMs).toISOString(),
      updatedAt: new Date(now - 2 * dayMs).toISOString()
    })

    expect(needsSync(pullRequest, noActiveIds, now)).toEqual(false)
  })
})
