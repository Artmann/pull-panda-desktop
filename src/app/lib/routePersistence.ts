const storageKey = 'last-route'

export function saveRoute(path: string): void {
  localStorage.setItem(storageKey, path)
}

export function getSavedRoute(): string | null {
  return localStorage.getItem(storageKey)
}
