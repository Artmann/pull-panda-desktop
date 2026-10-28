import { type ReactElement } from 'react'

import { Button } from '@/app/components/ui/button'
import {
  checkForUpdates,
  describeUpdateStatus,
  useInstallUpdate,
  useUpdateStatus
} from '@/app/lib/updates'

import { SettingRow, SettingsSection } from './section'

export function UpdateSettings(): ReactElement {
  const status = useUpdateStatus()
  const { install, isInstalling } = useInstallUpdate()

  const isBusy =
    status === null ||
    status.state === 'checking' ||
    status.state === 'downloading' ||
    status.state === 'unsupported'

  return (
    <SettingsSection title="Updates">
      <SettingRow
        description={
          status === null ? 'Loading…' : describeUpdateStatus(status)
        }
        label={status === null ? 'Version' : `Version ${status.currentVersion}`}
      >
        {status?.state === 'ready' ? (
          <Button
            disabled={isInstalling}
            size="sm"
            onClick={install}
          >
            {isInstalling ? 'Restarting…' : 'Restart to update'}
          </Button>
        ) : (
          <Button
            disabled={isBusy}
            size="sm"
            variant="outline"
            onClick={checkForUpdates}
          >
            Check for updates
          </Button>
        )}
      </SettingRow>
    </SettingsSection>
  )
}
