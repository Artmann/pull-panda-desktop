import { describe, expect, it } from 'vitest'

import type { CheckRollup } from '@/app/components/check-rollup'
import type { PullRequest } from '@/types/pull-request'

import { createMockPullRequest } from '../__test-helpers__/pull-request-fixtures'
import { buildRows, type SidebarRow } from './sidebar-data'
import {
  mergeDepartures,
  nextDepartureState,
  type DepartureState
} from './use-departing-rows'

const noCheckRollups = new Map<string, CheckRollup>()

function rowsOf(pullRequests: PullRequest[]): SidebarRow[] {
  return buildRows(pullRequests, noCheckRollups)
}

function idsOf(rows: readonly SidebarRow[]): string[] {
  return rows.map((row) => row.pullRequest.id)
}

const first = createMockPullRequest({ id: 'pr-a', number: 1 })
const second = createMockPullRequest({ id: 'pr-b', number: 2 })
const third = createMockPullRequest({ id: 'pr-c', number: 3 })

const open = [first, second, third]

function stateOf(pullRequests: PullRequest[]): DepartureState {
  return { departures: new Map(), rows: rowsOf(pullRequests) }
}

describe('nextDepartureState', () => {
  it('holds on to a row whose pull request has been merged', () => {
    const merged = { ...second, state: 'MERGED' as const }

    const next = nextDepartureState(stateOf(open), rowsOf([first, third]), [
      first,
      merged,
      third
    ])

    expect([...next.departures.keys()]).toEqual(['pr-b'])
    expect(next.departures.get('pr-b')?.index).toEqual(1)
  })

  it('shows the row as it has become, so the badge reads merged', () => {
    const merged = { ...second, state: 'MERGED' as const }

    const next = nextDepartureState(stateOf(open), rowsOf([first, third]), [
      first,
      merged,
      third
    ])

    expect(next.departures.get('pr-b')?.row.pullRequest).toEqual(merged)
    expect(next.departures.get('pr-b')?.row.mergeReadiness).toEqual('not-open')
  })

  it('holds on to a row whose pull request has been closed', () => {
    const closed = { ...second, state: 'CLOSED' as const }

    const next = nextDepartureState(stateOf(open), rowsOf([first, third]), [
      first,
      closed,
      third
    ])

    expect([...next.departures.keys()]).toEqual(['pr-b'])
  })

  it('holds on to a row whose pull request has left the store altogether', () => {
    const next = nextDepartureState(stateOf(open), rowsOf([first, third]), [
      first,
      third
    ])

    expect(next.departures.get('pr-b')?.row.pullRequest).toEqual(second)
  })

  it('drops a row that a filter hid without holding it back', () => {
    const next = nextDepartureState(stateOf(open), rowsOf([first, third]), open)

    expect(next.departures.size).toEqual(0)
  })

  it('takes several departures at once, each at its own index', () => {
    const next = nextDepartureState(stateOf(open), rowsOf([second]), [
      { ...first, state: 'MERGED' as const },
      second,
      { ...third, state: 'CLOSED' as const }
    ])

    expect(
      [...next.departures.values()].map((departure) => [
        departure.pullRequestId,
        departure.index
      ])
    ).toEqual([
      ['pr-a', 0],
      ['pr-c', 2]
    ])
  })

  it('lets go of a departure when its pull request comes back', () => {
    const merged = { ...second, state: 'MERGED' as const }

    const departing = nextDepartureState(
      stateOf(open),
      rowsOf([first, third]),
      [first, merged, third]
    )

    const rolledBack = nextDepartureState(departing, rowsOf(open), open)

    expect(rolledBack.departures.size).toEqual(0)
  })

  it('keeps a departure that is still on its way out', () => {
    const merged = { ...second, state: 'MERGED' as const }

    const departing = nextDepartureState(
      stateOf(open),
      rowsOf([first, third]),
      [first, merged, third]
    )

    const later = nextDepartureState(departing, rowsOf([first, third]), [
      first,
      merged,
      third
    ])

    expect([...later.departures.keys()]).toEqual(['pr-b'])
  })
})

describe('mergeDepartures', () => {
  it('leaves the rows alone when nothing is departing', () => {
    const rows = rowsOf(open)

    expect(mergeDepartures(rows, new Map())).toBe(rows)
  })

  it('puts a departing row back at the index it held', () => {
    const merged = { ...second, state: 'MERGED' as const }

    const next = nextDepartureState(stateOf(open), rowsOf([first, third]), [
      first,
      merged,
      third
    ])

    expect(idsOf(mergeDepartures(next.rows, next.departures))).toEqual([
      'pr-a',
      'pr-b',
      'pr-c'
    ])
  })

  it('puts several departing rows back in order', () => {
    const next = nextDepartureState(stateOf(open), rowsOf([second]), [
      { ...first, state: 'MERGED' as const },
      second,
      { ...third, state: 'CLOSED' as const }
    ])

    expect(idsOf(mergeDepartures(next.rows, next.departures))).toEqual([
      'pr-a',
      'pr-b',
      'pr-c'
    ])
  })

  it('clamps an index that is past the end of a shorter list', () => {
    const next = nextDepartureState(stateOf(open), rowsOf([]), [
      first,
      second,
      { ...third, state: 'MERGED' as const }
    ])

    expect(idsOf(mergeDepartures(next.rows, next.departures))).toEqual(['pr-c'])
  })
})
