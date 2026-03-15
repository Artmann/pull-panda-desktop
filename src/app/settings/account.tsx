import { type ReactElement } from 'react'

import { UserAvatar } from '../components/UserAvatar'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { useAuth } from '../lib/store/authContext'

export function AccountSettings(): ReactElement {
  const { logout, user } = useAuth()

  function handleSignOut() {
    logout().catch((error: unknown) => {
      console.error('Failed to sign out:', error)
    })
  }

  return (
    <div>
      <h2 className="text-xl font-medium mb-6">Account</h2>

      <Card className="pt-0">
        <CardContent>
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarUrl={user?.avatar_url}
                login={user?.login}
              />

              <div>
                <div className="font-medium">{user?.name ?? user?.login}</div>
                <div className="text-muted-foreground text-sm">
                  @{user?.login}
                </div>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
