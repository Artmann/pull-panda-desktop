/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { commandRegistry } from '../registry'

vi.mock('../theme-accessor', () => ({
  getThemeSetter: () => vi.fn()
}))

describe('appearance commands', () => {
  beforeEach(async () => {
    await import('./appearance')
  })

  it('registers the light mode command', () => {
    const command = commandRegistry.getById('appearance.light-mode')

    expect(command).toBeDefined()
    expect(command?.label).toEqual('Switch to Light Mode')
    expect(command?.group).toEqual('appearance')
  })

  it('registers the dark mode command', () => {
    const command = commandRegistry.getById('appearance.dark-mode')

    expect(command).toBeDefined()
    expect(command?.label).toEqual('Switch to Dark Mode')
    expect(command?.group).toEqual('appearance')
  })

  it('registers the system theme command', () => {
    const command = commandRegistry.getById('appearance.system-theme')

    expect(command).toBeDefined()
    expect(command?.label).toEqual('Switch to System Theme')
    expect(command?.group).toEqual('appearance')
  })

  it('all appearance commands are always available', () => {
    const lightCommand = commandRegistry.getById('appearance.light-mode')
    const darkCommand = commandRegistry.getById('appearance.dark-mode')
    const systemCommand = commandRegistry.getById('appearance.system-theme')

    expect(lightCommand?.isAvailable({} as never)).toEqual(true)
    expect(darkCommand?.isAvailable({} as never)).toEqual(true)
    expect(systemCommand?.isAvailable({} as never)).toEqual(true)
  })
})
