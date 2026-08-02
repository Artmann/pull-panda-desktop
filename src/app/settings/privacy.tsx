import { type ReactElement, type ReactNode, useEffect, useState } from 'react'

import { Card, CardContent } from '../components/ui/card'
import { Switch } from '../components/ui/switch'

import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'

export function PrivacySettings(): ReactElement {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void window.usage
      .getReportingEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(true))
  }, [])

  return (
    <div>
      <h2 className="text-xl font-medium mb-6">Privacy</h2>

      <Card className="pt-0">
        <CardContent>
          <SettingItem
            description="Sends an anonymous hourly ping (app version, OS, locale) that helps us understand how many people use Pull Panda. Never includes your account, repositories, or code."
            label="Share anonymous usage data"
          >
            <Switch
              checked={enabled ?? true}
              disabled={enabled === null}
              onCheckedChange={(next) => {
                const previous = enabled

                runOptimisticMutation({
                  errorMessage: 'Could not update usage reporting.',
                  optimistic: () => setEnabled(next),
                  request: () => window.usage.setReportingEnabled(next),
                  rollback: () => setEnabled(previous)
                })
              }}
            />
          </SettingItem>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingItem({
  children,
  description,
  label
}: {
  children: ReactNode
  description: string
  label: string
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-8 py-6 border-b last:border-b-0 border-border">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>

      <div>{children}</div>
    </div>
  )
}
