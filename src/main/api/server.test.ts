import { afterEach, describe, expect, it, vi } from 'vitest'

import { startApiServer, stopApiServer } from './server'

const fsMocks = vi.hoisted(() => ({
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn()
}))

// Keep the real fs module but stub the two calls that touch the port file so
// tests never write to disk. The electron stub resolves userData to ''.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('node:fs') & { default: typeof import('node:fs') }
  >()

  return {
    ...actual,
    default: {
      ...actual.default,
      unlinkSync: fsMocks.unlinkSync,
      writeFileSync: fsMocks.writeFileSync
    }
  }
})

afterEach(() => {
  stopApiServer()
  vi.clearAllMocks()
})

describe('startApiServer', () => {
  it('rejects requests with 401 when no token is available', async () => {
    const port = await startApiServer(() => null)

    const response = await fetch(`http://127.0.0.1:${port}/api/syncs`, {
      body: JSON.stringify({ reason: 'manual' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    })

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: 'Not authenticated' },
      status: 401
    })
  })

  it('serves the health endpoint and writes the port file when a token is available', async () => {
    const port = await startApiServer(() => 'token_123')

    const response = await fetch(`http://127.0.0.1:${port}/api/health`)

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { status: 'ok' },
      status: 200
    })
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith('api-port', String(port))
  })

  it('removes the port file when the server is stopped', async () => {
    await startApiServer(() => 'token_123')

    stopApiServer()

    expect(fsMocks.unlinkSync).toHaveBeenCalledWith('api-port')
  })
})
