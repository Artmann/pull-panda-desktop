import { AlertCircleIcon, Github, Loader2 } from 'lucide-react'

import { DeviceCodeCard } from '@/app/components/auth/DeviceCodeCard'
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import { useAuth } from '@/app/lib/store/authContext'

export function SignInPage() {
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
    <div className="w-full h-full flex flex-col justify-center items-center p-8">
      {isPolling ? (
        <DeviceCodeCard
          userCode={userCode}
          verificationUri={verificationUri}
          onOpenUrl={openVerificationUrl}
        />
      ) : (
        <div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold">Pull Panda</h1>
            </div>

            <div className="text-muted-foreground text-left text-lg mb-4">
              Make great code reviews the default for your team.
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Sign in failed</AlertTitle>
                <AlertDescription>
                  <div>{error}</div>
                </AlertDescription>
              </Alert>
            )}

            <div className="py-4">
              <Button
                className="gap-2"
                disabled={isLoading}
                size="lg"
                onClick={startLogin}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Github className="h-5 w-5" />
                )}
                {isLoading ? 'Connecting...' : 'Sign in with GitHub'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
