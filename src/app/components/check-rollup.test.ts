import { describe, expect, it } from 'vitest'

import type { Check } from '@/types/pull-request-details'

import {
  getCheckRollup,
  getCheckRollupLabel,
  getCheckRollupSummary,
  getCheckTally
} from './check-rollup'

function buildCheck(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    gitHubId: 'gh-1',
    pullRequestId: 'pr-1',
    name: 'build',
    state: 'completed',
    conclusion: 'success',
    commitSha: null,
    suiteName: null,
    durationInSeconds: null,
    detailsUrl: null,
    message: null,
    url: null,
    gitHubCreatedAt: null,
    gitHubUpdatedAt: null,
    syncedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('getCheckRollup', () => {
  it('reports none when there are no checks', () => {
    expect(getCheckRollup([])).toEqual('none')
  })

  it('reports passing when every check succeeded', () => {
    expect(
      getCheckRollup([buildCheck(), buildCheck({ id: 'check-2' })])
    ).toEqual('passing')
  })

  it('treats skipped checks as passing', () => {
    expect(getCheckRollup([buildCheck({ conclusion: 'skipped' })])).toEqual(
      'passing'
    )
  })

  it('reports failing when any check failed or errored', () => {
    expect(getCheckRollup([buildCheck({ conclusion: 'FAILURE' })])).toEqual(
      'failing'
    )
    expect(getCheckRollup([buildCheck({ conclusion: 'error' })])).toEqual(
      'failing'
    )
  })

  it('reports running when a check is queued or in progress and none failed', () => {
    expect(
      getCheckRollup([
        buildCheck(),
        buildCheck({ id: 'check-2', conclusion: null, state: 'in_progress' })
      ])
    ).toEqual('running')
  })

  it('prefers failing over running', () => {
    expect(
      getCheckRollup([
        buildCheck({ conclusion: 'failure' }),
        buildCheck({ id: 'check-2', conclusion: null, state: 'queued' })
      ])
    ).toEqual('failing')
  })
})

describe('getCheckRollupLabel', () => {
  it('names each rollup', () => {
    expect([
      getCheckRollupLabel('failing'),
      getCheckRollupLabel('none'),
      getCheckRollupLabel('passing'),
      getCheckRollupLabel('running')
    ]).toEqual([
      'Some checks have failed',
      'No checks available',
      'All checks have passed',
      'Checks are running'
    ])
  })
})

describe('getCheckRollupSummary', () => {
  it('counts each outcome in a fixed order', () => {
    const checks = [
      buildCheck({ id: 'a', conclusion: 'success' }),
      buildCheck({ id: 'b', conclusion: 'failure' }),
      buildCheck({ id: 'c', conclusion: 'skipped' }),
      buildCheck({ id: 'd', conclusion: null, state: 'queued' })
    ]

    expect(getCheckRollupSummary(checks)).toEqual(
      '1 running, 1 failed, 1 skipped, 1 successful'
    )
  })

  it('falls back to a plain count when nothing matches', () => {
    expect(
      getCheckRollupSummary([buildCheck({ conclusion: 'cancelled' })])
    ).toEqual('1 checks')
  })
})

describe('getCheckTally', () => {
  it('counts nothing for an empty suite', () => {
    expect(getCheckTally([])).toEqual({
      failed: 0,
      passing: 0,
      running: 0,
      skipped: 0,
      successful: 0,
      total: 0
    })
  })

  it('separates every outcome', () => {
    const checks = [
      buildCheck({ id: 'a', conclusion: 'success' }),
      buildCheck({ id: 'b', conclusion: 'SUCCESS' }),
      buildCheck({ id: 'c', conclusion: 'failure' }),
      buildCheck({ id: 'd', conclusion: 'skipped' }),
      buildCheck({ id: 'e', conclusion: null, state: 'in_progress' }),
      buildCheck({ id: 'f', conclusion: 'cancelled' })
    ]

    expect(getCheckTally(checks)).toEqual({
      failed: 1,
      passing: 3,
      running: 1,
      skipped: 1,
      successful: 2,
      total: 6
    })
  })

  it('counts a skipped check as passing, so the ratio agrees with the rollup', () => {
    const checks = [
      buildCheck({ id: 'a', conclusion: 'success' }),
      buildCheck({ id: 'b', conclusion: 'skipped' })
    ]
    const tally = getCheckTally(checks)

    expect([getCheckRollup(checks), tally.passing, tally.total]).toEqual([
      'passing',
      2,
      2
    ])
  })
})
