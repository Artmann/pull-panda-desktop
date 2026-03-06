import type { QueryClient } from '@tanstack/react-query'

let instance: QueryClient | null = null

export function setQueryClient(client: QueryClient): void {
  instance = client
}

export function getQueryClient(): QueryClient {
  if (!instance) {
    throw new Error('QueryClient not initialized')
  }

  return instance
}
