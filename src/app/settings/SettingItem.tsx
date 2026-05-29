import { type ReactElement, type ReactNode } from 'react'

export function SettingItem({
  children,
  description,
  label
}: {
  children: ReactNode
  description: string
  label: string
}): ReactElement {
  return (
    <div className="flex items-center justify-between py-6 border-b last:border-b-0 border-border">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>

      <div>{children}</div>
    </div>
  )
}
