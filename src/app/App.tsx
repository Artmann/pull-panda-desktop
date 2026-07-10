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
import { FpsCounter } from '@/app/components/FpsCounter'
import { TitleBar } from '@/app/components/TitleBar'
import { Toaster } from '@/app/components/ui/sonner'
import { AuthProvider, useAuth } from '@/app/lib/store/authContext'
import { TasksProvider } from '@/app/lib/store/tasksContext'
import { ThemeProvider } from '@/app/lib/store/themeContext'
import { BackgroundSyncerPage } from '@/app/routes/BackgroundSyncerPage'
import { HomePage } from '@/app/routes/HomePage'
import { OnboardingPage } from '@/app/routes/OnboardingPage'
import { DiffsWorkerPoolProvider } from '@/app/pull-requests/diffs/diffs-provider'
import { PullRequestNavigationProvider } from '@/app/pull-requests/PullRequestNavigationProvider'
import { PullRequestPage } from '@/app/routes/PullRequestPage'
import { SettingsPage } from '@/app/routes/SettingsPage'
import { SignInPage } from '@/app/routes/SignInPage'
import { TelemetryPage } from '@/app/routes/TelemetryPage'
import { getSavedRoute, saveRoute } from '@/app/lib/routePersistence'
import {
  initializeRendererTelemetry,
  startSpan
} from '@/app/lib/telemetry/tracer'
import { useAppDispatch } from '@/app/store/hooks'
import { resourceEventToAction } from '@/app/store/resource-event-to-action'
import { AppFooter } from './AppFooter'

interface AppProps {
  store: AppStore
}

export function App({ store }: AppProps): ReactElement {
  return (
    <Provider store={store}>
      <HashRouter>
        <ThemeProvider>
          <DiffsWorkerPoolProvider>
            <TasksProvider>
              <AuthProvider>
                <CommandContextProvider>
                  <PullRequestNavigationProvider>
                    <ShortcutListener />
                    <CommandPalette />
                    <FpsCounter />
                    <AppContent />
                  </PullRequestNavigationProvider>
                </CommandContextProvider>
              </AuthProvider>
            </TasksProvider>
            <Toaster />
          </DiffsWorkerPoolProvider>
        </ThemeProvider>
      </HashRouter>
    </Provider>
  )
}

function AppContent(): ReactElement {
  const { status, isNewSignIn } = useAuth()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  // Enable renderer telemetry once (no-ops in packaged builds).
  useEffect(() => {
    initializeRendererTelemetry().catch(() => {
      // Telemetry is best-effort and must never disrupt app startup.
    })
  }, [])

  // Record a renderer span for each navigation so the dashboard shows a
  // timeline of which views the user moved between.
  useEffect(() => {
    startSpan(`navigate ${location.pathname}`, {
      attributes: { path: location.pathname }
    }).end()
  }, [location.pathname])

  // Listen for navigation requests from the main process
  useEffect(() => {
    const unsubscribe = window.electron.onNavigateTo((path) => {
      navigate(path)
    })

    return unsubscribe
  }, [navigate])

  // Listen for resource updates from the main process
  useEffect(() => {
    const unsubscribe = window.electron.onResourceUpdated((event) => {
      dispatch(resourceEventToAction(event))
    })

    return unsubscribe
  }, [dispatch])

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

          <AppRoutes
            isAuthenticated={isAuthenticated}
            postSignInRedirect={postSignInRedirect}
          />
        </ErrorBoundary>
      </div>

      {isAuthenticated && <AppFooter />}
    </main>
  )
}

interface AppRoutesProps {
  isAuthenticated: boolean
  postSignInRedirect: string
}

function AppRoutes({
  isAuthenticated,
  postSignInRedirect
}: AppRoutesProps): ReactElement {
  return (
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
          isAuthenticated ? <OnboardingPage /> : <Navigate to="/sign-in" />
        }
      />
      <Route
        path="/"
        element={isAuthenticated ? <HomePage /> : <Navigate to="/sign-in" />}
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
          isAuthenticated ? <PullRequestPage /> : <Navigate to="/sign-in" />
        }
      />
      <Route
        path="/settings"
        element={
          isAuthenticated ? <SettingsPage /> : <Navigate to="/sign-in" />
        }
      />
      <Route
        path="/telemetry"
        element={
          isAuthenticated ? <TelemetryPage /> : <Navigate to="/sign-in" />
        }
      />
    </Routes>
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
