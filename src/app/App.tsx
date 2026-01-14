import { type ReactElement } from 'react'
import { Provider } from 'react-redux'
import { HashRouter, Routes, Route, Navigate } from 'react-router'
import { Loader2 } from 'lucide-react'

import type { AppStore } from '@/app/store'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { TitleBar } from '@/app/components/TitleBar'
import { Toaster } from '@/app/components/ui/sonner'
import { AuthProvider, useAuth } from '@/app/lib/store/authContext'
import { TasksProvider } from '@/app/lib/store/tasksContext'
import { BackgroundSyncerPage } from '@/app/routes/BackgroundSyncerPage'
import { HomePage } from '@/app/routes/HomePage'
import { OnboardingPage } from '@/app/routes/OnboardingPage'
import { PullRequestPage } from '@/app/routes/PullRequestPage'
import { SignInPage } from '@/app/routes/SignInPage'
import { AppFooter } from './AppFooter'

interface AppProps {
  store: AppStore
}

export function App({ store }: AppProps): ReactElement {
  return (
    <Provider store={store}>
      <HashRouter>
        <TasksProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </TasksProvider>
      </HashRouter>

      <Toaster />
    </Provider>
  )
}

function AppContent(): ReactElement {
  const { status, isNewSignIn } = useAuth()

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
    <div className="h-screen flex flex-col">
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
          </Routes>
        </ErrorBoundary>

        {isAuthenticated && <div className="w-full h-10" />}
      </div>

      {isAuthenticated && <AppFooter />}
    </div>
  )
}
