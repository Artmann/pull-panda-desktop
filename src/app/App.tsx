import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, type ReactElement } from 'react'
import { Provider } from 'react-redux'
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router'
import { Loader2 } from 'lucide-react'

import type { AppStore } from '@/app/store'
import {
  CommandContextProvider,
  CommandPalette,
  ShortcutListener
} from '@/app/commands'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { TitleBar } from '@/app/components/TitleBar'
import { Toaster } from '@/app/components/ui/sonner'
import { queryKeys } from '@/app/lib/query-keys'
import { isPullRequestInFlight } from '@/app/lib/queries/use-pull-requests'
import { AuthProvider, useAuth } from '@/app/lib/store/authContext'
import { CodeThemeProvider } from '@/app/lib/store/codeThemeContext'
import { TasksProvider } from '@/app/lib/store/tasksContext'
import { ThemeProvider } from '@/app/lib/store/themeContext'
import { BackgroundSyncerPage } from '@/app/routes/BackgroundSyncerPage'
import { HomePage } from '@/app/routes/HomePage'
import { OnboardingPage } from '@/app/routes/OnboardingPage'
import { PullRequestPage } from '@/app/routes/PullRequestPage'
import { SettingsPage } from '@/app/routes/SettingsPage'
import { SignInPage } from '@/app/routes/SignInPage'
import { getSavedRoute, saveRoute } from '@/app/lib/routePersistence'
import { useQueryClient } from '@tanstack/react-query'
import type { PullRequest } from '@/types/pull-request'
import type { Comment } from '@/types/pull-request-details'
import { AppFooter } from './AppFooter'

interface AppProps {
  queryClient: QueryClient
  store: AppStore
}

export function App({ queryClient, store }: AppProps): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <HashRouter>
          <ThemeProvider>
            <CodeThemeProvider>
              <TasksProvider>
                <AuthProvider>
                  <CommandContextProvider>
                    <ShortcutListener />
                    <CommandPalette />
                    <AppContent />
                  </CommandContextProvider>
                </AuthProvider>
              </TasksProvider>
            </CodeThemeProvider>
            <Toaster />
          </ThemeProvider>
        </HashRouter>
      </Provider>
    </QueryClientProvider>
  )
}

function AppContent(): ReactElement {
  const { status, isNewSignIn } = useAuth()
  const queryClient = useQueryClient()

  // Listen for resource updates from the main process
  useEffect(() => {
    const unsubscribe = window.electron.onResourceUpdated((event) => {
      switch (event.type) {
        case 'checks':
          queryClient.setQueryData(
            queryKeys.checks.byPullRequest(event.pullRequestId),
            event.data
          )
          break

        case 'comments': {
          // Preserve optimistic comments (temp- prefixed IDs)
          const previousComments =
            queryClient.getQueryData<Comment[]>(
              queryKeys.comments.byPullRequest(event.pullRequestId)
            ) ?? []

          const optimisticComments = previousComments.filter((c) =>
            c.id.startsWith('temp-')
          )

          queryClient.setQueryData(
            queryKeys.comments.byPullRequest(event.pullRequestId),
            [...event.data, ...optimisticComments]
          )
          break
        }

        case 'commits':
          queryClient.setQueryData(
            queryKeys.commits.byPullRequest(event.pullRequestId),
            event.data
          )
          break

        case 'modified-files':
          queryClient.setQueryData(
            queryKeys.modifiedFiles.byPullRequest(event.pullRequestId),
            event.data
          )
          break

        case 'pending-review':
          queryClient.setQueryData(
            queryKeys.pendingReviews.byPullRequest(event.pullRequestId),
            event.data ?? null
          )
          break

        case 'pull-request':
          // Skip IPC updates for PRs with in-flight optimistic mutations to
          // avoid overwriting optimistic data with stale DB values.
          if (isPullRequestInFlight(event.data.id)) {
            break
          }

          queryClient.setQueryData<PullRequest[]>(
            queryKeys.pullRequests.all,
            (previous = []) => {
              const index = previous.findIndex((pr) => pr.id === event.data.id)

              if (index >= 0) {
                const next = [...previous]
                next[index] = event.data

                return next
              }

              return [...previous, event.data]
            }
          )
          break

        case 'pull-requests':
          queryClient.setQueryData(
            queryKeys.pullRequests.all,
            event.data
          )
          break

        case 'reactions':
          queryClient.setQueryData(
            queryKeys.reactions.byPullRequest(event.pullRequestId),
            event.data
          )
          break

        case 'reviews':
          queryClient.setQueryData(
            queryKeys.reviews.byPullRequest(event.pullRequestId),
            event.data
          )
          break
      }
    })

    return unsubscribe
  }, [queryClient])

  // SyncComplete just signals the sync is done (no data fetching needed).
  useEffect(() => {
    const unsubscribe = window.electron.onSyncComplete(() => {
      // Sync status indicator could be updated here.
    })

    return unsubscribe
  }, [])

  if (status === 'loading') {
    return (
      <div className="h-screen flex flex-col">
        <TitleBar />

        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const isAuthenticated = status === 'authenticated'
  const postSignInRedirect = isNewSignIn ? '/onboarding' : '/'

  return (
    <main className="w-full h-screen flex flex-col overflow-hidden">
      <TitleBar />

      <div className="flex-1 min-h-0 overflow-auto ">
        <ErrorBoundary>
          {isAuthenticated && <RouteRestorer />}

          <Routes>
            <Route
              path="/sign-in"
              element={
                isAuthenticated ? (
                  <Navigate to={postSignInRedirect} />
                ) : (
                  <SignInPage />
                )
              }
            />
            <Route
              path="/onboarding"
              element={
                isAuthenticated ? (
                  <OnboardingPage />
                ) : (
                  <Navigate to="/sign-in" />
                )
              }
            />
            <Route
              path="/"
              element={
                isAuthenticated ? <HomePage /> : <Navigate to="/sign-in" />
              }
            />
            <Route
              path="/bg"
              element={
                isAuthenticated ? (
                  <BackgroundSyncerPage />
                ) : (
                  <Navigate to="/sign-in" />
                )
              }
            />
            <Route
              path="/pull-requests/:id"
              element={
                isAuthenticated ? (
                  <PullRequestPage />
                ) : (
                  <Navigate to="/sign-in" />
                )
              }
            />
            <Route
              path="/settings"
              element={
                isAuthenticated ? <SettingsPage /> : <Navigate to="/sign-in" />
              }
            />
          </Routes>
        </ErrorBoundary>
      </div>

      {isAuthenticated && <AppFooter />}
    </main>
  )
}

function RouteRestorer(): null {
  const location = useLocation()
  const navigate = useNavigate()
  const hasRestored = useRef(false)

  // Restore saved route once, before the browser paints
  useLayoutEffect(() => {
    if (hasRestored.current) {
      return
    }

    hasRestored.current = true

    const saved = getSavedRoute()
    const current = location.pathname + location.search

    if (saved && saved !== current) {
      navigate(saved, { replace: true })
    }
  }, [])

  // Persist current route on every navigation
  useEffect(() => {
    saveRoute(location.pathname + location.search)
  }, [location.pathname, location.search])

  return null
}
