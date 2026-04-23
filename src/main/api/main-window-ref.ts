import { BrowserWindow } from 'electron'

let mainWindowRef: BrowserWindow | null = null

export function getApiMainWindow(): BrowserWindow | null {
  return mainWindowRef
}

export function setApiMainWindow(window: BrowserWindow): void {
  mainWindowRef = window
}
