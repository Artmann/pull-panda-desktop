import { useHotkeys } from 'react-hotkeys-hook'

import { openCommandPaletteWithCommand } from './CommandPalette'
import { useCommandContext } from './context'
import { commandRegistry } from './registry'
import { matchesShortcut } from './shortcut-matching'
import type { Shortcut } from './types'

// Convert our Shortcut type to react-hotkeys-hook format
function shortcutToHotkeyString(shortcut: Shortcut): string {
  const parts: string[] = []

  if (shortcut.mod) parts.push('mod')
  if (shortcut.shift) parts.push('shift')
  if (shortcut.alt) parts.push('alt')
  parts.push(shortcut.key.toLowerCase())

  return parts.join('+')
}

export function ShortcutListener(): null {
  const { context } = useCommandContext()

  // Get all registered shortcuts
  const commands = commandRegistry.getAll()
  const commandsWithShortcuts = commands.filter(
    (cmd): cmd is typeof cmd & { shortcut: Shortcut } =>
      cmd.shortcut !== undefined
  )
  const hotkeyStrings = commandsWithShortcuts
    .map((cmd) => shortcutToHotkeyString(cmd.shortcut))
    .join(', ')

  useHotkeys(
    hotkeyStrings || 'placeholder-that-never-matches',
    (event, handler) => {
      // Find the command that matches this hotkey
      // handler.keys only contains non-modifier keys, so we need to reconstruct
      const key = handler.keys?.[0] ?? ''
      const modifiers = {
        alt: event.altKey,
        mod: event.metaKey || event.ctrlKey,
        shift: event.shiftKey
      }

      const command = commandsWithShortcuts.find(
        (candidate) =>
          matchesShortcut(candidate.shortcut, key, modifiers) &&
          candidate.isAvailable(context)
      )

      if (!command) {
        return
      }

      event.preventDefault()

      // For parameterized commands, open the palette in params mode
      if (command.param) {
        openCommandPaletteWithCommand(command)
      } else {
        command.execute(context)
      }
    },
    {
      enableOnFormTags: false,
      preventDefault: false
    },
    [context, commandsWithShortcuts]
  )

  return null
}
