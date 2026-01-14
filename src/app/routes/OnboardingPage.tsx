import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'

import { triggerSync } from '@/app/lib/api'
import { useAuth } from '@/app/lib/store/authContext'

const syncTimeout = 10_000

export function OnboardingPage() {
  const navigate = useNavigate()
  const { clearNewSignIn } = useAuth()

  useEffect(() => {
    clearNewSignIn()
    triggerSync()

    const unsubscribe = window.electron.onSyncComplete((event) => {
      if (event.type === 'pull-requests') {
        navigate('/')
      }
    })

    const timeout = setTimeout(() => {
      navigate('/')
    }, syncTimeout)

    return () => {
      unsubscribe()
      clearTimeout(timeout)
    }
  }, [clearNewSignIn, navigate])

  return (
    <div className="w-full h-full flex flex-col justify-center items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />

      <p className="text-muted-foreground">Syncing your pull requests...</p>
    </div>
  )
}
