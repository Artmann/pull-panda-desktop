import { useEffect, useState } from 'react'

import { isMac } from '@/app/commands/utils'

/**
 * Whether the jump-shortcut modifier is currently held — Cmd on macOS, Ctrl
 * elsewhere, matching how `mod` resolves in the command registry.
 *
 * Tracks keyup as well as keydown, so it has to cope with the two ways a keyup
 * never arrives: switching apps with the modifier down (Cmd+Tab), and opening a
 * context menu. Both clear the state, otherwise the badges stay stuck on.
 */
export function useModifierHeld(): boolean {
  const [isHeld, setIsHeld] = useState(false)

  useEffect(() => {
    const modifierKey = isMac() ? 'Meta' : 'Control'

    const isModifierDown = (event: KeyboardEvent): boolean =>
      isMac() ? event.metaKey : event.ctrlKey

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === modifierKey) {
        setIsHeld(true)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      // Reading the modifier flag rather than the key covers releasing the
      // modifier and a character key in either order.
      if (event.key === modifierKey || !isModifierDown(event)) {
        setIsHeld(false)
      }
    }

    const clear = () => {
      setIsHeld(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clear)
    window.addEventListener('contextmenu', clear)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clear)
      window.removeEventListener('contextmenu', clear)
    }
  }, [])

  return isHeld
}
