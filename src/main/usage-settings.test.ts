import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadUsageSettings, setUsageReportingEnabled } from './usage-settings'

const { getPathMock } = vi.hoisted(() => ({
  getPathMock: vi.fn<() => string>()
}))

vi.mock('electron', () => ({
  app: { getPath: getPathMock }
}))

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('usage settings', () => {
  let storePath: string
  let userDataPath: string

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-settings-'))
    storePath = path.join(userDataPath, 'usage-settings.json')

    getPathMock.mockReturnValue(userDataPath)
  })

  afterEach(() => {
    fs.rmSync(userDataPath, { force: true, recursive: true })
  })

  it('creates and persists defaults on first load', () => {
    const settings = loadUsageSettings()

    expect(settings).toEqual({
      enabled: true,
      installId: expect.stringMatching(uuidPattern)
    })

    const onDisk = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as unknown

    expect(onDisk).toEqual(settings)
  })

  it('returns the same settings on subsequent loads', () => {
    expect(loadUsageSettings()).toEqual(loadUsageSettings())
  })

  it('regenerates defaults when the file is corrupt', () => {
    fs.writeFileSync(storePath, 'not json at all', 'utf-8')

    expect(loadUsageSettings()).toEqual({
      enabled: true,
      installId: expect.stringMatching(uuidPattern)
    })
  })

  it('sanitizes an invalid enabled flag but keeps a valid install id', () => {
    const installId = randomUUID()

    fs.writeFileSync(
      storePath,
      JSON.stringify({ enabled: 'yes', installId }),
      'utf-8'
    )

    expect(loadUsageSettings()).toEqual({ enabled: true, installId })
  })

  it('regenerates an invalid install id but keeps the enabled flag', () => {
    fs.writeFileSync(
      storePath,
      JSON.stringify({ enabled: false, installId: 'not-a-uuid' }),
      'utf-8'
    )

    const settings = loadUsageSettings()

    expect(settings).toEqual({
      enabled: false,
      installId: expect.stringMatching(uuidPattern)
    })
  })

  it('persists the enabled flag and preserves the install id', () => {
    const initial = loadUsageSettings()

    setUsageReportingEnabled(false)

    expect(loadUsageSettings()).toEqual({
      enabled: false,
      installId: initial.installId
    })
  })
})
