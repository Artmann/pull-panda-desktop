import { type ReactElement } from 'react'

import { Button } from '@/app/components/ui/button'
import { UserAvatar } from '@/app/components/UserAvatar'
import { useAuth } from '@/app/lib/store/authContext'

import { SettingsSection } from './section'

export function AccountSettings(): ReactElement {
  const { logout, user } = useAuth()

  function handleSignOut() {
    logout().catch((error: unknown) => {
      console.error('Failed to sign out:', error)
    })
  }

  return (
    <SettingsSection title="Account">
      <div className="flex items-center justify-between gap-8 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            avatarUrl={user?.avatar_url}
            login={user?.login}
          />

          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {user?.name ?? user?.login}
            </div>

            <div className="truncate text-xs text-muted-foreground">
              @{user?.login}
            </div>
          </div>
        </div>

        <Button
          onClick={handleSignOut}
          size="sm"
          variant="outline"
        >
          Sign out
        </Button>
      </div>
    </SettingsSection>
  )
}
