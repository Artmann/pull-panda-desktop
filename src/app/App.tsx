import { type ReactElement } from 'react'
import { Loader2 } from 'lucide-react'

import { AuthProvider, useAuth } from '@/lib/store/authContext'
import { LoginPage } from '@/app/pages/LoginPage'
import { HomePage } from '@/app/pages/HomePage'

function AppContent(): ReactElement {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'authenticated') {
    return <HomePage />
  }

  return <LoginPage />
}

export function App(): ReactElement {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
