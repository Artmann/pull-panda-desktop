import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode
} from 'react'
import { useStore } from 'react-redux'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router'

import type { AppStore } from '@/app/store'
import { useAppSelector } from '@/app/store/hooks'
import type { Comment, ModifiedFile } from '@/types/pull-request-details'

import { setStore } from './store-accessor'
import type { CommandContext, CommandView } from './types'

type CommandContextValue = {
  context: CommandContext
  setSelectedFile: (file: ModifiedFile | undefined) => void
  setSelectedComment: (comment: Comment | undefined) => void
}

const CommandReactContext = createContext<CommandContextValue | null>(null)

// Store navigate function for use in commands
let navigateFunction: NavigateFunction | null = null

export function getNavigate(): NavigateFunction {
  if (!navigateFunction) {
    throw new Error(
      'Navigate function not initialized. Is CommandContextProvider mounted?'
    )
  }
  return navigateFunction
}

type CommandContextProviderProps = {
  children: ReactNode
}

// Extract PR ID from pathname like /pull-requests/abc123
function extractPullRequestId(pathname: string): string | undefined {
  const match = pathname.match(/^\/pull-requests\/([^/]+)/)
  return match?.[1]
}

export function CommandContextProvider({
  children
}: CommandContextProviderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const store = useStore() as AppStore

  // Store references for commands to use
  useEffect(() => {
    navigateFunction = navigate
    setStore(store)
    return () => {
      navigateFunction = null
    }
  }, [navigate, store])

  // Extract PR ID from pathname (useParams doesn't work outside Routes)
  const pullRequestId = extractPullRequestId(location.pathname)

  const pullRequest = useAppSelector((state) =>
    pullRequestId
      ? state.pullRequests.items.find((pr) => pr.id === pullRequestId)
      : undefined
  )

  const pullRequestDetails = useAppSelector((state) =>
    pullRequestId ? state.pullRequestDetails[pullRequestId] : undefined
  )

  // Derive view from current path
  const view: CommandView = useMemo(() => {
    if (location.pathname.startsWith('/pull-requests/')) return 'pr-detail'
    if (location.pathname === '/') return 'home'
    return 'other'
  }, [location.pathname])

  // File and comment selection state
  const [selectedFile, setSelectedFile] = useState<ModifiedFile | undefined>()
  const [selectedComment, setSelectedComment] = useState<Comment | undefined>()

  // Clear selections when navigating away from PR detail
  useEffect(() => {
    if (view !== 'pr-detail') {
      setSelectedFile(undefined)
      setSelectedComment(undefined)
    }
  }, [view])

  const context: CommandContext = useMemo(
    () => ({
      view,
      pullRequest,
      pullRequestDetails,
      selectedFile,
      selectedComment
    }),
    [view, pullRequest, pullRequestDetails, selectedFile, selectedComment]
  )

  const value: CommandContextValue = useMemo(
    () => ({
      context,
      setSelectedFile,
      setSelectedComment
    }),
    [context]
  )

  return (
    <CommandReactContext.Provider value={value}>
      {children}
    </CommandReactContext.Provider>
  )
}

export function useCommandContext(): CommandContextValue {
  const context = useContext(CommandReactContext)

  if (!context) {
    throw new Error(
      'useCommandContext must be used within a CommandContextProvider'
    )
  }

  return context
}
