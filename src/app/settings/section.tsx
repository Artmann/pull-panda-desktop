import { type ReactElement, type ReactNode } from 'react'

interface SettingsSectionProps {
  children: ReactNode
  title: string
}

// A titled group of rows. Rows sit directly on the page and are separated by
// hairlines rather than wrapped in a card.
export function SettingsSection({
  children,
  title
}: SettingsSectionProps): ReactElement {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>

      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

interface SettingRowProps {
  children: ReactNode
  description?: string
  label: string
}

export function SettingRow({
  children,
  description,
  label
}: SettingRowProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-8 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>

        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  )
}
