import { type ReactElement, type ReactNode, useState } from 'react'
import { usePostHog } from '@posthog/react'

import { Card, CardContent } from '../components/ui/card'
import { Switch } from '../components/ui/switch'

import {
  applyAnalyticsConsent,
  getStoredAnalyticsEnabled,
  setStoredAnalyticsEnabled
} from '@/app/lib/analytics'

export function PrivacySettings(): ReactElement {
  const posthog = usePostHog()
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() =>
    getStoredAnalyticsEnabled()
  )

  const handleAnalyticsChange = (enabled: boolean) => {
    setAnalyticsEnabled(enabled)
    setStoredAnalyticsEnabled(enabled)

    // Capture the change *before* opting out so the off-event still lands.
    if (!enabled) {
      posthog?.capture('analytics_disabled')
    }

    applyAnalyticsConsent(posthog, enabled)

    if (enabled) {
      posthog?.capture('analytics_enabled')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-medium mb-6">Privacy</h2>

      <Card className="pt-0">
        <CardContent>
          <SettingItem
            description="Help improve Pull Panda by sharing anonymous usage data. No code or repository contents are ever sent."
            label="Share usage analytics"
          >
            <Switch
              checked={analyticsEnabled}
              onCheckedChange={handleAnalyticsChange}
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
    <div className="flex items-center justify-between py-6 border-b last:border-b-0 border-border gap-6">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>

      <div>{children}</div>
    </div>
  )
}
