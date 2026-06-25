import { describe, expect, it } from 'vitest'

import { parseArgs } from './inspect-traces'

describe('parseArgs', () => {
  it('uses sensible defaults with no arguments', () => {
    expect(parseArgs([])).toEqual({
      errorsOnly: false,
      json: false,
      limit: 30,
      operation: null,
      search: null,
      sinceMs: null,
      slow: false,
      stats: false,
      traceId: null
    })
  })

  it('parses boolean flags', () => {
    const options = parseArgs(['--slow', '--errors', '--json', '--stats'])

    expect(options.slow).toEqual(true)
    expect(options.errorsOnly).toEqual(true)
    expect(options.json).toEqual(true)
    expect(options.stats).toEqual(true)
  })

  it('parses value flags', () => {
    const options = parseArgs([
      '--trace',
      'abc123',
      '--op',
      'sync.checks',
      '--limit',
      '5'
    ])

    expect(options.traceId).toEqual('abc123')
    expect(options.search).toEqual('sync.checks')
    expect(options.operation).toEqual('sync.checks')
    expect(options.limit).toEqual(5)
  })

  it('converts a relative since value into a past timestamp', () => {
    const before = Date.now()
    const options = parseArgs(['--since', '5m'])

    expect(options.sinceMs).not.toBeNull()
    expect(options.sinceMs).toBeLessThanOrEqual(before - 5 * 60 * 1000 + 50)
    expect(options.sinceMs).toBeGreaterThan(before - 5 * 60 * 1000 - 1000)
  })
})
