import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  SettingsIcon,
  SquareIcon,
  XIcon
} from 'lucide-react'
import { type ReactElement, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { cn } from '@/app/lib/utils'
import { closeSettings } from '@/app/settings/close-settings'
import { Wordmark } from './PandaMark'

const isMac = navigator.platform.toLowerCase().includes('mac')

export function TitleBar(): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const maxHistoryIndexRef = useRef(0)

  const historyIndex = (window.history.state?.idx as number) ?? 0

  useEffect(() => {
    if (historyIndex > maxHistoryIndexRef.current) {
      maxHistoryIndexRef.current = historyIndex
    }
  }, [historyIndex, location])

  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex < maxHistoryIndexRef.current
  const isSettingsActive = location.pathname === '/settings'

  const handleBack = () => {
    navigate(-1)
  }

  const handleForward = () => {
    navigate(1)
  }

  const handleOpenSettings = () => {
    navigate('/settings')
  }

  const handleCloseSettings = () => {
    closeSettings(navigate)
  }

  const handleMinimize = () => {
    window.electron.windowMinimize()
  }

  const handleMaximize = () => {
    window.electron.windowMaximize()
  }

  const handleClose = () => {
    window.electron.windowClose()
  }

  return (
    <div className="title-bar h-8 flex items-center justify-between bg-titlebar border-b border-border select-none">
      {/*
        macOS keeps its traffic lights in the top-left corner, so the buttons
        are padded clear of them and pushed to the far side of this column.
        Everywhere else the corner is ours, and they sit flush against it.
      */}
      <div
        className={cn(
          'flex-1 max-w-50 h-full flex items-center',
          isMac && 'pl-17 justify-end'
        )}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <NavigationButton
          disabled={!canGoBack}
          onClick={handleBack}
          testId="title-bar-back"
        >
          <ChevronLeftIcon className="size-4" />
        </NavigationButton>

        <NavigationButton
          disabled={!canGoForward}
          onClick={handleForward}
          testId="title-bar-forward"
        >
          <ChevronRightIcon className="size-4" />
        </NavigationButton>

        <TitleBarToggle
          isActive={isSettingsActive}
          label={isSettingsActive ? 'Close settings' : 'Open settings'}
          onClick={isSettingsActive ? handleCloseSettings : handleOpenSettings}
          testId="title-bar-settings"
        >
          <SettingsIcon className="size-4" />
        </TitleBarToggle>
      </div>

      <div
        className="flex-1 h-full min-w-90 flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <Wordmark />
      </div>

      <div className="h-full flex-1 max-w-50">
        {!isMac && (
          <div className="h-full flex items-center float-right">
            <WindowButton
              onClick={handleMinimize}
              testId="title-bar-minimize"
            >
              <MinusIcon className="size-4" />
            </WindowButton>

            <WindowButton
              onClick={handleMaximize}
              testId="title-bar-maximize"
            >
              <SquareIcon className="size-3" />
            </WindowButton>

            <WindowButton
              className="hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleClose}
              testId="title-bar-close"
            >
              <XIcon className="size-4" />
            </WindowButton>
          </div>
        )}
      </div>
    </div>
  )
}

interface WindowButtonProps {
  children: React.ReactNode
  className?: string
  onClick: () => void
  testId?: string
}

function WindowButton({
  children,
  className,
  onClick,
  testId
}: WindowButtonProps): ReactElement {
  return (
    <button
      className={cn(
        'w-12 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
        className
      )}
      data-testid={testId}
      onClick={onClick}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      type="button"
    >
      {children}
    </button>
  )
}

interface NavigationButtonProps {
  children: React.ReactNode
  disabled: boolean
  onClick: () => void
  testId?: string
}

function NavigationButton({
  children,
  disabled,
  onClick,
  testId
}: NavigationButtonProps): ReactElement {
  return (
    <button
      className={cn(
        'w-8 h-full flex items-center justify-center transition-colors',
        disabled
          ? 'text-muted-foreground/40 cursor-default'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

interface TitleBarToggleProps {
  children: React.ReactNode
  isActive: boolean
  label: string
  onClick: () => void
  testId?: string
}

// A page toggle: opens its page, and closes it again when it is already open.
function TitleBarToggle({
  children,
  isActive,
  label,
  onClick,
  testId
}: TitleBarToggleProps): ReactElement {
  return (
    <button
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        'w-8 h-full flex items-center justify-center transition-colors hover:bg-muted',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}
