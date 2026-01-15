import type { Shortcut } from './types'

export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

export function formatShortcut(shortcut: Shortcut): string {
  const mac = isMac()
  const parts: string[] = []

  if (shortcut.mod) parts.push(mac ? '⌘' : 'Ctrl')
  if (shortcut.shift) parts.push(mac ? '⇧' : 'Shift')
  if (shortcut.alt) parts.push(mac ? '⌥' : 'Alt')
  parts.push(shortcut.key.toUpperCase())

  return parts.join(mac ? '' : '+')
}

export function eventToShortcut(event: KeyboardEvent): Shortcut {
  return {
    key: event.key.toLowerCase(),
    mod: isMac() ? event.metaKey : event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey
  }
}

export function shortcutsMatch(a: Shortcut, b: Shortcut): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    Boolean(a.mod) === Boolean(b.mod) &&
    Boolean(a.shift) === Boolean(b.shift) &&
    Boolean(a.alt) === Boolean(b.alt)
  )
}

export function isInputFocused(): boolean {
  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') return true

  // Check for contenteditable
  if (activeElement.getAttribute('contenteditable') === 'true') return true

  return false
}
