import type { Shortcut } from './types'

interface PressedModifiers {
  alt: boolean
  mod: boolean
  shift: boolean
}

// Checks whether a registered shortcut matches the pressed key and modifiers.
export function matchesShortcut(
  shortcut: Shortcut,
  key: string,
  modifiers: PressedModifiers
): boolean {
  const altMatches = Boolean(shortcut.alt) === modifiers.alt
  const keyMatches = shortcut.key.toLowerCase() === key.toLowerCase()
  const modMatches = Boolean(shortcut.mod) === modifiers.mod
  const shiftMatches = Boolean(shortcut.shift) === modifiers.shift

  return altMatches && keyMatches && modMatches && shiftMatches
}
