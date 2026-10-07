export type LandmarkRegistry = Map<string, Map<string, HTMLElement>>

const landmarkJumpOffset = 80

const noop = (): void => {
  // Intentional no-op cleanup when there is nothing to unregister.
}

/**
 * Adds `element` to the registry under `scopeKey` and `id`. Returns a cleanup
 * function that removes it again, and drops the scope once it is empty.
 */
export function addLandmark(
  registry: LandmarkRegistry,
  scopeKey: string,
  id: string,
  element: HTMLElement | null
): () => void {
  if (!scopeKey || !element) {
    return noop
  }

  let landmarks = registry.get(scopeKey)

  if (!landmarks) {
    landmarks = new Map()
    registry.set(scopeKey, landmarks)
  }

  landmarks.set(id, element)

  return () => {
    const currentLandmarks = registry.get(scopeKey)

    if (!currentLandmarks) {
      return
    }

    if (currentLandmarks.get(id) === element) {
      currentLandmarks.delete(id)
    }

    if (currentLandmarks.size === 0) {
      registry.delete(scopeKey)
    }
  }
}

/** Connected landmarks in `scopeKey`, ordered top to bottom on screen. */
export function getSortedLandmarks(
  registry: LandmarkRegistry,
  scopeKey: string | null
): HTMLElement[] {
  if (!scopeKey) {
    return []
  }

  const landmarks = registry.get(scopeKey)

  if (!landmarks) {
    return []
  }

  return Array.from(landmarks.values())
    .filter((element) => element.isConnected)
    .sort((a, b) => {
      const aTop = a.getBoundingClientRect().top
      const bTop = b.getBoundingClientRect().top

      return aTop - bTop
    })
}

function getRelativeTop(container: HTMLElement, element: HTMLElement): number {
  const containerTop = container.getBoundingClientRect().top

  return (
    element.getBoundingClientRect().top - containerTop + container.scrollTop
  )
}

/** The first landmark that sits below the current jump position. */
export function findNextLandmark(
  container: HTMLElement,
  sorted: HTMLElement[]
): HTMLElement | undefined {
  return sorted.find(
    (element) =>
      getRelativeTop(container, element) >
      container.scrollTop + landmarkJumpOffset + 1
  )
}

/** The last landmark in the run that sits above the current jump position. */
export function findPreviousLandmark(
  container: HTMLElement,
  sorted: HTMLElement[]
): HTMLElement | null {
  let previous: HTMLElement | null = null

  for (const element of sorted) {
    if (
      getRelativeTop(container, element) <
      container.scrollTop + landmarkJumpOffset - 1
    ) {
      previous = element
    } else {
      break
    }
  }

  return previous
}

export function scrollToLandmark(
  container: HTMLElement,
  element: HTMLElement
): void {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const targetTop =
    container.scrollTop +
    (elementRect.top - containerRect.top) -
    landmarkJumpOffset

  container.scrollTo({
    top: Math.max(0, targetTop),
    behavior: 'smooth'
  })
}
