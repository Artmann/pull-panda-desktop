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

  // Node 25+ exposes a native `localStorage`/`sessionStorage` global whose
  // methods throw without the `--localstorage-file` flag. Install an
  // in-memory polyfill on both window and globalThis so bare
  // `localStorage.getItem(...)` calls work regardless of the runtime.
  class MemoryStorage {
    private store = new Map<string, string>()

    get length(): number {
      return this.store.size
    }

    clear(): void {
      this.store.clear()
    }

    getItem(key: string): string | null {
      return this.store.get(key) ?? null
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null
    }

    removeItem(key: string): void {
      this.store.delete(key)
    }

    setItem(key: string, value: string): void {
      this.store.set(key, String(value))
    }
  }

  for (const name of ['localStorage', 'sessionStorage'] as const) {
    const storage = new MemoryStorage()

    for (const target of [globalThis, window] as unknown[]) {
      try {
        Object.defineProperty(target as object, name, {
          configurable: true,
          value: storage,
          writable: true
        })
      } catch {
        // Best effort — fall through to direct assignment.
        try {
          ;(target as Record<string, unknown>)[name] = storage
        } catch {
          // Ignore.
        }
      }
    }
  }
}
