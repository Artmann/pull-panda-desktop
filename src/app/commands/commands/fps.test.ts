/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  getFpsCounterVisible,
  setFpsCounterVisible
} from '@/app/lib/fps-counter-state'

import { commandRegistry } from '../registry'

describe('fps commands', () => {
  beforeEach(async () => {
    setFpsCounterVisible(false)
    await import('./fps')
  })

  it('registers the FPS counter toggle command', () => {
    const command = commandRegistry.getById('view.toggle-fps-counter')

    expect(command).toBeDefined()
    expect(command?.label).toEqual('Toggle FPS Counter')
    expect(command?.group).toEqual('view')
    expect(command?.isAvailable({ view: 'home' })).toEqual(true)
  })

  it('toggles FPS counter visibility', () => {
    const command = commandRegistry.getById('view.toggle-fps-counter')

    command?.execute({ view: 'home' })

    expect(getFpsCounterVisible()).toEqual(true)

    command?.execute({ view: 'home' })

    expect(getFpsCounterVisible()).toEqual(false)
  })
})
