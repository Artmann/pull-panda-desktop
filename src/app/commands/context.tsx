import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode
} from 'react'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router'

import { useChecks } from '@/app/lib/queries/use-checks'
import { useComments } from '@/app/lib/queries/use-comments'
import { useCommits } from '@/app/lib/queries/use-commits'
import { useModifiedFiles } from '@/app/lib/queries/use-modified-files'
import { usePullRequest } from '@/app/lib/queries/use-pull-requests'
import { useReactions } from '@/app/lib/queries/use-reactions'
import { useReviews } from '@/app/lib/queries/use-reviews'
import { setQueryClient } from '@/app/lib/query-client-accessor'
import type {
  Comment,
  ModifiedFile,
  PullRequestDetails
} from '@/types/pull-request-details'
import { useQueryClient } from '@tanstack/react-query'

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
  const queryClient = useQueryClient()

  // Store references for commands to use
  useEffect(() => {
    navigateFunction = navigate
    setQueryClient(queryClient)
    return () => {
      navigateFunction = null
    }
  }, [navigate, queryClient])

  // Extract PR ID from pathname (useParams doesn't work outside Routes)
  const pullRequestId = extractPullRequestId(location.pathname)

  const pullRequest = usePullRequest(pullRequestId)
  const checks = useChecks(pullRequestId ?? '')
  const comments = useComments(pullRequestId ?? '')
  const commits = useCommits(pullRequestId ?? '')
  const files = useModifiedFiles(pullRequestId ?? '')
  const reactions = useReactions(pullRequestId ?? '')
  const reviews = useReviews(pullRequestId ?? '')

  const pullRequestDetails: PullRequestDetails | undefined = useMemo(
    () =>
      pullRequestId
        ? { checks, comments, commits, files, reactions, reviews }
        : undefined,
    [pullRequestId, checks, comments, commits, files, reactions, reviews]
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
