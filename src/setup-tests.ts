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

  // Node 25+ ships a native `localStorage`/`sessionStorage` global that
  // throws without the `--localstorage-file` flag. Shadow it with jsdom's
  // window storage so bare `localStorage.getItem(...)` calls work.
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    if (window[key]) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: window[key],
        writable: true
      })
    }
  }
}
