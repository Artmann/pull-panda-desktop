import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/store/authContext'

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        {user?.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.login}
            className="h-20 w-20 rounded-full"
          />
        )}

        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            Welcome, {user?.name || user?.login}!
          </h1>
          <p className="text-muted-foreground">@{user?.login}</p>
        </div>

        <p className="text-muted-foreground">You're signed in to Pull Panda</p>

        <Button
          variant="outline"
          onClick={logout}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
