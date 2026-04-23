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

export interface PullRequestNavigationApi {
  getScrollPosition: (pullRequestId: string, tab: string) => number
  registerScrollContainer: (element: HTMLElement | null) => void
  setActiveKey: (pullRequestId: string, tab: string) => void
  setActiveTab: (pullRequestId: string, tab: string) => void
}

const PullRequestNavigationContext =
  createContext<PullRequestNavigationApi | null>(null)

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

  const api: PullRequestNavigationApi = useMemo(
    () => ({
      getScrollPosition,
      registerScrollContainer,
      setActiveKey,
      setActiveTab
    }),
    [getScrollPosition, registerScrollContainer, setActiveKey, setActiveTab]
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
