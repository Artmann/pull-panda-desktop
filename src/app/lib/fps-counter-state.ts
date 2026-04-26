import { useSyncExternalStore } from 'react'

let isVisible = false
const listeners = new Set<() => void>()

export function getFpsCounterVisible(): boolean {
  return isVisible
}

export function setFpsCounterVisible(nextIsVisible: boolean): void {
  if (isVisible === nextIsVisible) {
    return
  }

  isVisible = nextIsVisible

  for (const listener of listeners) {
    listener()
  }
}

export function subscribeToFpsCounterVisible(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function toggleFpsCounterVisible(): void {
  setFpsCounterVisible(!isVisible)
}

export function useFpsCounterVisible(): boolean {
  return useSyncExternalStore(
    subscribeToFpsCounterVisible,
    getFpsCounterVisible,
    getFpsCounterVisible
  )
}
