/**
 * How many rows get a mod+<digit> jump shortcut. Capped at 9 because Electron's
 * default menu binds mod+0 to resetZoom.
 */
export const maximumJumpShortcuts = 9

export interface SidebarNavigationApi {
  /** Zero-based index into the sidebar's current, filtered, sorted order. */
  selectIndex: (index: number) => void
  selectNext: () => void
  selectPrevious: () => void
}

let instance: SidebarNavigationApi | null = null

export function setSidebarNavigation(api: SidebarNavigationApi | null): void {
  instance = api
}

export function getSidebarNavigation(): SidebarNavigationApi | null {
  return instance
}
