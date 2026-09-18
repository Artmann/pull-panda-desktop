export interface SidebarNavigationApi {
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
