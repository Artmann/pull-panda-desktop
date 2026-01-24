import { useEffect, type ReactElement } from 'react'
import { Provider } from 'react-redux'
import { HashRouter, Routes, Route, Navigate } from 'react-router'
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
import { TasksProvider } from '@/app/lib/store/tasksContext'
import { ThemeProvider } from '@/app/lib/store/themeContext'
import { BackgroundSyncerPage } from '@/app/routes/BackgroundSyncerPage'
import { HomePage } from '@/app/routes/HomePage'
import { OnboardingPage } from '@/app/routes/OnboardingPage'
import { PullRequestPage } from '@/app/routes/PullRequestPage'
import { SettingsPage } from '@/app/routes/SettingsPage'
import { SignInPage } from '@/app/routes/SignInPage'
import { useAppDispatch } from '@/app/store/hooks'
import { pullRequestDetailsActions } from '@/app/store/pull-request-details-slice'
import { AppFooter } from './AppFooter'

interface AppProps {
  store: AppStore
}

export function App({ store }: AppProps): ReactElement {
  return (
    <Provider store={store}>
      <HashRouter>
        <ThemeProvider>
          <TasksProvider>
            <AuthProvider>
              <CommandContextProvider>
                <ShortcutListener />
                <CommandPalette />
                <AppContent />
              </CommandContextProvider>
            </AuthProvider>
          </TasksProvider>
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
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <TitleBar />

      <div className="flex-1 min-h-0 overflow-auto">
        <ErrorBoundary>
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
    </div>
  )
}
