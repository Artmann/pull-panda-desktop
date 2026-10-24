import { type ReactElement, useEffect, useState } from 'react'

import { Switch } from '@/app/components/ui/switch'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'

import { SettingRow, SettingsSection } from './section'

export function PrivacySettings(): ReactElement {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void window.usage
      .getReportingEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(true))
  }, [])

  return (
    <SettingsSection title="Privacy">
      <SettingRow
        description="Sends anonymous usage statistics: the app version, OS and locale, and which features you use, like submitting a review. Never your account, repositories, code or anything you type."
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
      </SettingRow>
    </SettingsSection>
  )
}
