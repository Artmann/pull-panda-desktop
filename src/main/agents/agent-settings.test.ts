import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadAgentSettings,
  setAgentOverride,
  setDefaultAgent
} from './agent-settings'

const { getPathMock } = vi.hoisted(() => ({
  getPathMock: vi.fn<() => string>()
}))

vi.mock('electron', () => ({
  app: { getPath: getPathMock }
}))

describe('agent settings', () => {
  let storePath: string
  let userDataPath: string

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-settings-'))
    storePath = path.join(userDataPath, 'agent-settings.json')

    getPathMock.mockReturnValue(userDataPath)
  })

  afterEach(() => {
    fs.rmSync(userDataPath, { force: true, recursive: true })
  })

  it('returns defaults when no file exists', () => {
    expect(loadAgentSettings()).toEqual({ defaultAgent: null, overrides: {} })
  })

  it('returns defaults when the file is corrupt', () => {
    fs.writeFileSync(storePath, 'not json', 'utf-8')

    expect(loadAgentSettings()).toEqual({ defaultAgent: null, overrides: {} })
  })

  it('persists and reloads an override', () => {
    setAgentOverride('claude', 'C:\\tools\\claude.cmd')

    expect(loadAgentSettings()).toEqual({
      defaultAgent: null,
      overrides: { claude: 'C:\\tools\\claude.cmd' }
    })
  })

  it('clears an override when given null', () => {
    setAgentOverride('claude', 'C:\\tools\\claude.cmd')
    setAgentOverride('claude', null)

    expect(loadAgentSettings()).toEqual({ defaultAgent: null, overrides: {} })
  })

  it('persists the default agent', () => {
    setDefaultAgent('codex')

    expect(loadAgentSettings()).toEqual({
      defaultAgent: 'codex',
      overrides: {}
    })
  })

  it('drops unknown agents and invalid values on load', () => {
    fs.writeFileSync(
      storePath,
      JSON.stringify({
        defaultAgent: 'clippy',
        overrides: { claude: 42, clippy: '/bin/clippy', codex: '/bin/codex' }
      }),
      'utf-8'
    )

    expect(loadAgentSettings()).toEqual({
      defaultAgent: null,
      overrides: { codex: '/bin/codex' }
    })
  })
})
