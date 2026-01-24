import { type ReactElement } from 'react'

export function SettingsPage(): ReactElement {
  return (
    <div className="bg-background w-full p-4 sm:p-6">
      <div className="w-full max-w-6xl mx-auto">
        <section className="mb-8">
          <h1 className="md:text-xl font-medium text-gray-900 dark:text-white">
            Settings
          </h1>
        </section>
      </div>
    </div>
  )
}
