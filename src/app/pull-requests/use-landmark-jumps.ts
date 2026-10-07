import { useCallback, useRef, type RefObject } from 'react'

import {
  addLandmark,
  findNextLandmark,
  findPreviousLandmark,
  getSortedLandmarks,
  scrollToLandmark,
  type LandmarkRegistry
} from './landmarks'

interface LandmarkJumps {
  jumpToLandmark: (id: string) => void
  jumpToNextLandmark: () => void
  jumpToPreviousLandmark: () => void
  registerLandmark: (
    scopeKey: string,
    id: string,
    element: HTMLElement | null
  ) => () => void
}

/**
 * Keeps track of the landmarks registered per `prId::tab` scope and scrolls
 * the container between the ones in the active scope.
 */
export function useLandmarkJumps(
  containerRef: RefObject<HTMLElement | null>,
  activeKeyRef: RefObject<string | null>
): LandmarkJumps {
  const landmarksRef = useRef<LandmarkRegistry>(new Map())

  const registerLandmark = useCallback(
    (scopeKey: string, id: string, element: HTMLElement | null) =>
      addLandmark(landmarksRef.current, scopeKey, id, element),
    []
  )

  const jumpToNextLandmark = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const sorted = getSortedLandmarks(
      landmarksRef.current,
      activeKeyRef.current
    )
    const next = findNextLandmark(container, sorted)

    if (next) {
      scrollToLandmark(container, next)
    }
  }, [activeKeyRef, containerRef])

  const jumpToPreviousLandmark = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const sorted = getSortedLandmarks(
      landmarksRef.current,
      activeKeyRef.current
    )
    const previous = findPreviousLandmark(container, sorted)

    if (previous) {
      scrollToLandmark(container, previous)
    }
  }, [activeKeyRef, containerRef])

  const jumpToLandmark = useCallback(
    (id: string) => {
      const key = activeKeyRef.current
      const container = containerRef.current

      if (!key || !container) {
        return
      }

      const element = landmarksRef.current.get(key)?.get(id)

      if (!element) {
        return
      }

      scrollToLandmark(container, element)
    },
    [activeKeyRef, containerRef]
  )

  return {
    jumpToLandmark,
    jumpToNextLandmark,
    jumpToPreviousLandmark,
    registerLandmark
  }
}
