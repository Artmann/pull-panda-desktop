import { XIcon } from 'lucide-react'
import { type ReactElement } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { type NavigateFunction, useNavigate } from 'react-router'

import { Button } from '@/app/components/ui/button'

/**
 * Settings is a full-width page without the sidebar, so it needs an explicit
 * way out. Return to wherever the user came from, or to Home when the app
 * launched straight into Settings and there is nothing to go back to.
 */
export function closeSettings(navigate: NavigateFunction): void {
  const historyIndex = (window.history.state?.idx as number | null) ?? 0

  if (historyIndex > 0) {
    navigate(-1)
  } else {
    navigate('/', { replace: true })
  }
}

export function CloseSettingsButton(): ReactElement {
  const navigate = useNavigate()

  // Radix layers (the Select dropdowns on this page) dismiss on Escape during
  // the capture phase and mark the event as handled, so this only runs when
  // no dropdown was open.
  useHotkeys(
    'escape',
    (event) => {
      if (event.defaultPrevented) {
        return
      }

      closeSettings(navigate)
    },
    [navigate]
  )

  return (
    <Button
      aria-label="Close settings"
      onClick={() => {
        closeSettings(navigate)
      }}
      size="icon-sm"
      variant="ghost"
    >
      <XIcon className="size-4" />
    </Button>
  )
}
