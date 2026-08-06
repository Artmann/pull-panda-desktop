import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendUsagePing } from './usage-ping'
import { setUsageReportingEnabled } from './usage-settings'

const { getLocaleMock, getPathMock, getVersionMock } = vi.hoisted(() => ({
  getLocaleMock: vi.fn<() => string>(),
  getPathMock: vi.fn<() => string>(),
  getVersionMock: vi.fn<() => string>()
}))

vi.mock('electron', () => ({
  app: {
    getLocale: getLocaleMock,
    getPath: getPathMock,
    getVersion: getVersionMock
  }
}))

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('sendUsagePing', () => {
  const fetchMock = vi.fn<typeof fetch>()

  let userDataPath: string

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-ping-'))

    getLocaleMock.mockReturnValue('en-US')
    getPathMock.mockReturnValue(userDataPath)
    getVersionMock.mockReturnValue('1.1.0')

    Object.defineProperty(process, 'getSystemVersion', {
      configurable: true,
      value: () => '15.5'
    })

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fs.rmSync(userDataPath, { force: true, recursive: true })
    Reflect.deleteProperty(process, 'getSystemVersion')
    vi.unstubAllGlobals()
  })

  it('posts the full payload when reporting is enabled', async () => {
    await sendUsagePing()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] ?? []

    expect(url).toEqual('https://pullpanda.io/api/app/ping')
    expect(init).toEqual({
      body: expect.any(String),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    })

    const body = typeof init?.body === 'string' ? init.body : ''
    const payload = JSON.parse(body) as unknown

    expect(payload).toEqual({
      appVersion: '1.1.0',
      installId: expect.stringMatching(uuidPattern),
      locale: 'en-US',
      osVersion: '15.5',
      platform: process.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  })

  it('sends nothing when reporting is disabled', async () => {
    setUsageReportingEnabled(false)

    await sendUsagePing()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves without throwing when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(sendUsagePing()).resolves.toBeUndefined()
  })

  it('resolves without throwing when fetch throws synchronously', async () => {
    fetchMock.mockImplementation(() => {
      throw new Error('boom')
    })

    await expect(sendUsagePing()).resolves.toBeUndefined()
  })

  it('truncates over-length fields to the schema limits', async () => {
    getLocaleMock.mockReturnValue('x'.repeat(30))
    getVersionMock.mockReturnValue('9'.repeat(40))

    await sendUsagePing()

    const [, init] = fetchMock.mock.calls[0] ?? []
    const body = typeof init?.body === 'string' ? init.body : ''
    const payload = JSON.parse(body) as { appVersion: string; locale: string }

    expect(payload.locale).toEqual('x'.repeat(16))
    expect(payload.appVersion).toEqual('9'.repeat(32))
  })
})
