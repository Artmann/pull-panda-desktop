import { type ReactElement } from 'react'
import { Provider } from 'react-redux'
import { HashRouter, Routes, Route } from 'react-router'
import { Loader2 } from 'lucide-react'

import type { AppStore } from '@/app/store'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { TitleBar } from '@/app/components/TitleBar'
import { AuthProvider, useAuth } from '@/app/lib/store/authContext'
import { TasksProvider } from '@/app/lib/store/tasksContext'
import { LoginPage } from '@/app/pages/LoginPage'
import { BackgroundSyncerPage } from '@/app/routes/BackgroundSyncerPage'
import { HomePage } from '@/app/routes/HomePage'
import { PullRequestPage } from '@/app/routes/PullRequestPage'
import { AppFooter } from './AppFooter'

interface AppProps {
  store: AppStore
}

export function App({ store }: AppProps): ReactElement {
  return (
    <Provider store={store}>
      <TasksProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TasksProvider>
    </Provider>
  )
}

function AppContent(): ReactElement {
  const { status } = useAuth()

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

  if (status === 'authenticated') {
    return (
      <div className="h-screen flex flex-col">
        <TitleBar />

        <div className="flex-1 min-h-0 overflow-auto">
          <ErrorBoundary>
            <HashRouter>
              <Routes>
                <Route
                  path="/"
                  element={<HomePage />}
                />
                <Route
                  path="/bg"
                  element={<BackgroundSyncerPage />}
                />
                <Route
                  path="/pull-requests/:id"
                  element={<PullRequestPage />}
                />
              </Routes>
            </HashRouter>
          </ErrorBoundary>

          <div className="w-full h-10" />
        </div>

        <AppFooter />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <TitleBar />

      <div className="flex-1 min-h-0 overflow-auto">
        <LoginPage />
      </div>
    </div>
  )
}
