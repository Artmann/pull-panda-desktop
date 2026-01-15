import { useEffect } from 'react'

import { useCommandContext } from './context'
import { commandRegistry } from './registry'
import { eventToShortcut, isInputFocused } from './utils'

export function ShortcutListener(): null {
  const { context } = useCommandContext()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't intercept shortcuts when user is typing
      if (isInputFocused()) return

      const shortcut = eventToShortcut(event)
      const command = commandRegistry.findByShortcut(shortcut)

      if (command && command.isAvailable(context)) {
        event.preventDefault()
        command.execute(context)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [context])

  return null
}
