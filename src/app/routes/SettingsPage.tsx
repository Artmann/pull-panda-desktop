import { type ReactElement } from 'react'

import { AccountSettings } from '@/app/settings/account'
import { AppearanceSettings } from '@/app/settings/appearance'
import { CloseSettingsButton } from '@/app/settings/close-settings'
import { PrivacySettings } from '@/app/settings/privacy'

export function SettingsPage(): ReactElement {
  return (
    <div className="bg-background w-full px-6 py-5">
      <div className="mx-auto flex w-full max-w-content flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Settings</h1>

          <CloseSettingsButton />
        </div>

        <AccountSettings />
        <AppearanceSettings />
        <PrivacySettings />
      </div>
    </div>
  )
}
