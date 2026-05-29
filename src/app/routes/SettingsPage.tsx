import { type ReactElement } from 'react'
import { AccountSettings } from '../settings/account'
import { AppearanceSettings } from '../settings/appearance'
import { FilesSettings } from '../settings/files'

export function SettingsPage(): ReactElement {
  return (
    <div className="bg-background w-full p-4 sm:p-6">
      <div className="w-full max-w-3xl mx-auto">
        <section className="flex flex-col gap-8">
          <h1 className="text-2xl font-medium">Settings</h1>

          <AccountSettings />
          <AppearanceSettings />
          <FilesSettings />
        </section>
      </div>
    </div>
  )
}
