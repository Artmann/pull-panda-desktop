import { type ReactElement } from 'react'
import { AppearanceSettings } from '../settings/appearance'

export function SettingsPage(): ReactElement {
  return (
    <div className="bg-background w-full p-4 sm:p-6">
      <div className="w-full max-w-3xl mx-auto">
        <section className="flex flex-col gap-8">
          <h1 className="text-2xl font-medium">Settings</h1>

          <AppearanceSettings />
        </section>
      </div>
    </div>
  )
}
