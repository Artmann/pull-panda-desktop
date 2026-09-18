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

  // jsdom ships no ResizeObserver. Without it @tanstack/react-virtual never
  // measures its scroll container, so virtualized lists render zero rows and
  // any component that constructs one directly throws. A no-op stub leaves the
  // virtualizer on its `initialRect`, which is a screenful.
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub implements ResizeObserver {
      disconnect(): void {
        // No layout in jsdom, so there is nothing to observe.
      }

      observe(): void {
        // No layout in jsdom, so there is nothing to observe.
      }

      unobserve(): void {
        // No layout in jsdom, so there is nothing to observe.
      }
    }

    globalThis.ResizeObserver = ResizeObserverStub
  }

  // jsdom has no layout, so every element reports `offsetHeight`/`offsetWidth`
  // of 0. @tanstack/react-virtual sizes its viewport from those, and a zero
  // height means it renders no rows at all. Report a screenful so virtualized
  // lists can be tested.
  // jsdom defines these as getters that always return 0, so they are replaced
  // rather than filled in.
  for (const [name, size] of [
    ['offsetHeight', 800],
    ['offsetWidth', 400]
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement): number {
        return this.isConnected ? size : 0
      }
    })
  }

  // jsdom implements no layout, so it ships no `scrollIntoView`. Components
  // that keep a selected row on screen call it on mount.
  const elementPrototype = Element.prototype as Partial<Element>

  if (typeof elementPrototype.scrollIntoView !== 'function') {
    elementPrototype.scrollIntoView = (): void => undefined
  }

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
          const record = target as Record<string, unknown>
          record[name] = storage
        } catch {
          // Ignore.
        }
      }
    }
  }
}
