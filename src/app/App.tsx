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
import { useAppDispatch } from '@/app/store/hooks'
import { pullRequestDetailsActions } from '@/app/store/pull-request-details-slice'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { AppFooter } from './AppFooter'

interface AppProps {
  store: AppStore
}

export function App({ store }: AppProps): ReactElement {
  return (
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
  )
}

function AppContent(): ReactElement {
  const { status, isNewSignIn } = useAuth()
  const dispatch = useAppDispatch()

  // Listen for resource updates from the main process
  useEffect(() => {
    const unsubscribe = window.electron.onResourceUpdated(async (event) => {
      if (event.type === 'pull-request-details' && event.pullRequestId) {
        const details = await window.electron.getPullRequestDetails(
          event.pullRequestId
        )

        if (details) {
          dispatch(
            pullRequestDetailsActions.setDetails({
              pullRequestId: event.pullRequestId,
              details
            })
          )
        }

        const pullRequest = await window.electron.getPullRequest(
          event.pullRequestId
        )

        if (pullRequest?.detailsSyncedAt) {
          dispatch(pullRequestsActions.upsertItem(pullRequest))
        }
      }
    })

    return unsubscribe
  }, [dispatch])

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
    <main className="w-screen h-screen flex flex-col overflow-hidden">
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
