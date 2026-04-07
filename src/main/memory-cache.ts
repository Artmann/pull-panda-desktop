interface CacheEntry<T> {
  expiresAt: number
  value: T
}

export class MemoryCache<T> {
  private entries = new Map<string, CacheEntry<T>>()

  get(key: string): T | null {
    const entry = this.entries.get(key)

    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)

      return null
    }

    return entry.value
  }

  set(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, {
      expiresAt: Date.now() + ttlMs,
      value
    })
  }
}
