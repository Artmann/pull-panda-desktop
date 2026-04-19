import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: (): void => undefined,
      removeListener: (): void => undefined,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
      dispatchEvent: (): boolean => false
    })
  })

  // Node 25+ ships a native `localStorage`/`sessionStorage` global without
  // useful methods unless `--localstorage-file` is set. Delete Node's
  // version and install jsdom's so bare `localStorage.getItem(...)` works.
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    const storage = window[key]

    if (!storage) {
      continue
    }

    try {
      delete (globalThis as Record<string, unknown>)[key]
    } catch {
      // Ignore — will be overwritten by defineProperty below.
    }

    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: storage,
      writable: true
    })
  }
}
