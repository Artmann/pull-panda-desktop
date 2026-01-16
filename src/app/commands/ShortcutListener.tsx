import { useHotkeys } from 'react-hotkeys-hook'

import { useCommandContext } from './context'
import { commandRegistry } from './registry'
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
      const pressedKey = handler.keys?.join('+') ?? ''

      for (const command of commandsWithShortcuts) {
        const commandHotkey = shortcutToHotkeyString(command.shortcut)

        if (commandHotkey === pressedKey && command.isAvailable(context)) {
          event.preventDefault()
          command.execute(context)
          break
        }
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
