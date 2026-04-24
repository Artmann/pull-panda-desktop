import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode
} from 'react'
import { useNavigate } from 'react-router'

import { setPullRequestNavigation } from '@/app/commands/pr-navigation-accessor'

const toKey = (pullRequestId: string, tab: string): string =>
  `${pullRequestId}::${tab}`

const landmarkJumpOffset = 80

const noop = (): void => {
  // Intentional no-op cleanup when there is nothing to unregister.
}

export interface PullRequestNavigationApi {
  getScrollPosition: (pullRequestId: string, tab: string) => number
  jumpToLandmark: (id: string) => void
  jumpToNextLandmark: () => void
  jumpToPreviousLandmark: () => void
  registerLandmark: (
    scopeKey: string,
    id: string,
    element: HTMLElement | null
  ) => () => void
  registerScrollContainer: (element: HTMLElement | null) => void
  setActiveKey: (pullRequestId: string, tab: string) => void
  setActiveTab: (pullRequestId: string, tab: string) => void
}

const PullRequestNavigationContext =
  createContext<PullRequestNavigationApi | null>(null)

const LandmarkScopeContext = createContext<string | null>(null)

interface PullRequestNavigationProviderProps {
  children: ReactNode
}

export function PullRequestNavigationProvider({
  children
}: PullRequestNavigationProviderProps) {
  const navigate = useNavigate()

  const containerRef = useRef<HTMLElement | null>(null)
  const scrollListenerCleanupRef = useRef<(() => void) | null>(null)
  const scrollPositionsRef = useRef<Map<string, number>>(new Map())
  const activeKeyRef = useRef<string | null>(null)
  const landmarksRef = useRef<Map<string, Map<string, HTMLElement>>>(new Map())

  const registerScrollContainer = useCallback((element: HTMLElement | null) => {
    if (containerRef.current === element) {
      return
    }

    scrollListenerCleanupRef.current?.()
    scrollListenerCleanupRef.current = null
    containerRef.current = element

    if (!element) {
      return
    }

    let rafId: number | null = null

    const onScroll = () => {
      if (rafId !== null) {
        return
      }

      rafId = requestAnimationFrame(() => {
        rafId = null

        const key = activeKeyRef.current

        if (key) {
          scrollPositionsRef.current.set(key, element.scrollTop)
        }
      })
    }

    element.addEventListener('scroll', onScroll)

    scrollListenerCleanupRef.current = () => {
      element.removeEventListener('scroll', onScroll)

      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])

  const setActiveKey = useCallback((pullRequestId: string, tab: string) => {
    activeKeyRef.current = toKey(pullRequestId, tab)
  }, [])

  const getScrollPosition = useCallback(
    (pullRequestId: string, tab: string): number => {
      return scrollPositionsRef.current.get(toKey(pullRequestId, tab)) ?? 0
    },
    []
  )

  const setActiveTab = useCallback(
    (pullRequestId: string, tab: string) => {
      navigate(`/pull-requests/${pullRequestId}?tab=${tab}`)
    },
    [navigate]
  )

  const registerLandmark = useCallback(
    (scopeKey: string, id: string, element: HTMLElement | null) => {
      if (!scopeKey || !element) {
        return noop
      }

      let landmarks = landmarksRef.current.get(scopeKey)

      if (!landmarks) {
        landmarks = new Map()
        landmarksRef.current.set(scopeKey, landmarks)
      }

      landmarks.set(id, element)

      return () => {
        const currentLandmarks = landmarksRef.current.get(scopeKey)

        if (!currentLandmarks) {
          return
        }

        if (currentLandmarks.get(id) === element) {
          currentLandmarks.delete(id)
        }

        if (currentLandmarks.size === 0) {
          landmarksRef.current.delete(scopeKey)
        }
      }
    },
    []
  )

  const getSortedLandmarks = useCallback((): HTMLElement[] => {
    const key = activeKeyRef.current

    if (!key) {
      return []
    }

    const landmarks = landmarksRef.current.get(key)

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
  }, [])

  const scrollToElement = useCallback((element: HTMLElement) => {
    const container = containerRef.current

    if (!container) {
      return
    }

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
  }, [])

  const jumpToNextLandmark = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const sorted = getSortedLandmarks()
    const containerTop = container.getBoundingClientRect().top

    const next = sorted.find((element) => {
      const relativeTop =
        element.getBoundingClientRect().top -
        containerTop +
        container.scrollTop

      return relativeTop > container.scrollTop + landmarkJumpOffset + 1
    })

    if (next) {
      scrollToElement(next)
    }
  }, [getSortedLandmarks, scrollToElement])

  const jumpToPreviousLandmark = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const sorted = getSortedLandmarks()
    const containerTop = container.getBoundingClientRect().top

    let previous: HTMLElement | null = null

    for (const element of sorted) {
      const relativeTop =
        element.getBoundingClientRect().top -
        containerTop +
        container.scrollTop

      if (relativeTop < container.scrollTop + landmarkJumpOffset - 1) {
        previous = element
      } else {
        break
      }
    }

    if (previous) {
      scrollToElement(previous)
    }
  }, [getSortedLandmarks, scrollToElement])

  const jumpToLandmark = useCallback(
    (id: string) => {
      const key = activeKeyRef.current

      if (!key) {
        return
      }

      const landmarks = landmarksRef.current.get(key)
      const element = landmarks?.get(id)

      if (!element) {
        return
      }

      scrollToElement(element)
    },
    [scrollToElement]
  )

  const api: PullRequestNavigationApi = useMemo(
    () => ({
      getScrollPosition,
      jumpToLandmark,
      jumpToNextLandmark,
      jumpToPreviousLandmark,
      registerLandmark,
      registerScrollContainer,
      setActiveKey,
      setActiveTab
    }),
    [
      getScrollPosition,
      jumpToLandmark,
      jumpToNextLandmark,
      jumpToPreviousLandmark,
      registerLandmark,
      registerScrollContainer,
      setActiveKey,
      setActiveTab
    ]
  )

  useEffect(() => {
    setPullRequestNavigation(api)

    return () => {
      setPullRequestNavigation(null)
    }
  }, [api])

  useEffect(() => {
    return () => {
      scrollListenerCleanupRef.current?.()
      scrollListenerCleanupRef.current = null
    }
  }, [])

  return (
    <PullRequestNavigationContext.Provider value={api}>
      {children}
    </PullRequestNavigationContext.Provider>
  )
}

export function usePullRequestNavigation(): PullRequestNavigationApi {
  const context = useContext(PullRequestNavigationContext)

  if (!context) {
    throw new Error(
      'usePullRequestNavigation must be used within a PullRequestNavigationProvider'
    )
  }

  return context
}

export function useLandmark(
  id: string
): (element: HTMLElement | null) => void {
  const navigation = useContext(PullRequestNavigationContext)
  const scopeKey = useContext(LandmarkScopeContext)
  const cleanupRef = useRef<(() => void) | null>(null)

  return useCallback(
    (element: HTMLElement | null) => {
      cleanupRef.current?.()
      cleanupRef.current = null

      if (!navigation || !element || !scopeKey) {
        return
      }

      cleanupRef.current = navigation.registerLandmark(scopeKey, id, element)
    },
    [id, navigation, scopeKey]
  )
}

interface LandmarkScopeProps {
  children: ReactNode
  pullRequestId: string
  tab: string
}

export function LandmarkScope({
  children,
  pullRequestId,
  tab
}: LandmarkScopeProps): ReactNode {
  const key = useMemo(() => toKey(pullRequestId, tab), [pullRequestId, tab])

  return (
    <LandmarkScopeContext.Provider value={key}>
      {children}
    </LandmarkScopeContext.Provider>
  )
}
