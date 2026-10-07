import { describe, expect, it } from 'vitest'

import {
  getAdjacentId,
  getPlaceholder,
  groupCommands
} from './command-palette-utils'
import type { Command } from './types'

function createCommand(overrides: Partial<Command> = {}): Command {
  return {
    execute: () => undefined,
    group: 'app',
    id: 'test.command',
    isAvailable: () => true,
    label: 'Test Command',
    ...overrides
  }
}

describe('getAdjacentId', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('returns undefined when there are no items', () => {
    expect(getAdjacentId([], undefined, 'down')).toEqual(undefined)
  })

  it('selects the first item when moving down with no selection', () => {
    expect(getAdjacentId(items, undefined, 'down')).toEqual('a')
  })

  it('moves down to the next item', () => {
    expect(getAdjacentId(items, 'a', 'down')).toEqual('b')
  })

  it('wraps to the first item when moving down from the last', () => {
    expect(getAdjacentId(items, 'c', 'down')).toEqual('a')
  })

  it('selects the last item when moving up with no selection', () => {
    expect(getAdjacentId(items, undefined, 'up')).toEqual('c')
  })

  it('moves up to the previous item', () => {
    expect(getAdjacentId(items, 'c', 'up')).toEqual('b')
  })

  it('wraps to the last item when moving up from the first', () => {
    expect(getAdjacentId(items, 'a', 'up')).toEqual('c')
  })
})

describe('getPlaceholder', () => {
  const command = createCommand({
    param: {
      getOptions: () => [],
      placeholder: 'Pick a theme...',
      type: 'select'
    }
  })

  it('returns the default placeholder in commands mode', () => {
    expect(getPlaceholder('commands', command)).toEqual(
      'Type a command or search...'
    )
  })

  it('returns the command placeholder in params mode', () => {
    expect(getPlaceholder('params', command)).toEqual('Pick a theme...')
  })

  it('falls back to the default placeholder when the command has none', () => {
    expect(getPlaceholder('params', createCommand())).toEqual(
      'Type a command or search...'
    )
  })
})

describe('groupCommands', () => {
  const theme = createCommand({
    group: 'appearance',
    id: 'theme',
    label: 'Toggle Theme'
  })
  const settings = createCommand({
    group: 'app',
    id: 'settings',
    label: 'Open Settings'
  })
  const sidebar = createCommand({
    group: 'appearance',
    id: 'sidebar',
    label: 'Toggle Sidebar'
  })

  it('groups all commands by group in order when there is no query', () => {
    expect(groupCommands([theme, settings, sidebar], '')).toEqual(
      new Map([
        ['appearance', [theme, sidebar]],
        ['app', [settings]]
      ])
    )
  })

  it('filters commands by label, ignoring case', () => {
    expect(groupCommands([theme, settings, sidebar], 'SIDE')).toEqual(
      new Map([['appearance', [sidebar]]])
    )
  })

  it('ignores a whitespace-only query', () => {
    expect(groupCommands([settings], '   ')).toEqual(
      new Map([['app', [settings]]])
    )
  })
})
