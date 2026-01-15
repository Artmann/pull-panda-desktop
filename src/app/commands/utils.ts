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
