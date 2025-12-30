import { Github, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { DeviceCodeCard } from '@/app/components/auth/DeviceCodeCard'
import { useAuth } from '@/app/lib/store/authContext'

export function LoginPage() {
  const {
    status,
    userCode,
    verificationUri,
    error,
    startLogin,
    openVerificationUrl
  } = useAuth()

  const isLoading = status === 'requesting'
  const isPolling = status === 'polling' && userCode && verificationUri

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {isPolling ? (
        <DeviceCodeCard
          userCode={userCode}
          verificationUri={verificationUri}
          onOpenUrl={openVerificationUrl}
        />
      ) : (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Pull Panda</h1>
            <p className="text-muted-foreground">
              Connect your GitHub account to get started
            </p>
          </div>

          <Button
            size="lg"
            onClick={startLogin}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Github className="h-5 w-5" />
            )}
            {isLoading ? 'Connecting...' : 'Sign in with GitHub'}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}
