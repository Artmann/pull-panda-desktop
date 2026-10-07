import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode
} from 'react'
import { useLocation, useNavigate } from 'react-router'

import { setPullRequestNavigation } from '@/app/commands/pr-navigation-accessor'

import { useLandmarkJumps } from './use-landmark-jumps'
import {
  toNavigationKey,
  useScrollPositionRegistry
} from './use-scroll-position-registry'

export interface PullRequestNavigationApi {
  getActiveTab: () => string | undefined
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

/** The `tab` URL parameter, exposed as a stable getter plus a tab setter. */
function useTabRouting(): Pick<
  PullRequestNavigationApi,
  'getActiveTab' | 'setActiveTab'
> {
  const navigate = useNavigate()
  const location = useLocation()

  // Derived from the URL rather than a ref, so it is empty whenever no pull
  // request is open and never goes stale.
  const activeTab = new URLSearchParams(location.search).get('tab') ?? undefined

  const getActiveTab = useCallback((): string | undefined => {
    return activeTab
  }, [activeTab])

  const setActiveTab = useCallback(
    (pullRequestId: string, tab: string) => {
      navigate(`/pull-requests/${pullRequestId}?tab=${tab}`)
    },
    [navigate]
  )

  return { getActiveTab, setActiveTab }
}

export function PullRequestNavigationProvider({
  children
}: PullRequestNavigationProviderProps) {
  const {
    activeKeyRef,
    containerRef,
    getScrollPosition,
    registerScrollContainer,
    setActiveKey
  } = useScrollPositionRegistry()
  const {
    jumpToLandmark,
    jumpToNextLandmark,
    jumpToPreviousLandmark,
    registerLandmark
  } = useLandmarkJumps(containerRef, activeKeyRef)
  const { getActiveTab, setActiveTab } = useTabRouting()

  const api: PullRequestNavigationApi = useMemo(
    () => ({
      getActiveTab,
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
      getActiveTab,
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

export function useLandmark(id: string): (element: HTMLElement | null) => void {
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
  const key = useMemo(
    () => toNavigationKey(pullRequestId, tab),
    [pullRequestId, tab]
  )

  return (
    <LandmarkScopeContext.Provider value={key}>
      {children}
    </LandmarkScopeContext.Provider>
  )
}
