import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  MinusIcon,
  SettingsIcon,
  SquareIcon,
  XIcon
} from 'lucide-react'
import { type ReactElement, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { cn } from '@/app/lib/utils'

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
  const isHomeActive = location.pathname === '/'
  const isSettingsActive = location.pathname === '/settings'

  const handleBack = () => {
    navigate(-1)
  }

  const handleForward = () => {
    navigate(1)
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
    <div className="title-bar h-8 flex items-center justify-between bg-background border-b border-border select-none">
      <div
        className={cn('flex-1 max-w-50 h-full', isMac && 'pl-17')}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="h-full flex items-center float-right">
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

          <TitleBarLink
            isActive={isHomeActive}
            testId="title-bar-home"
            to="/"
          >
            <HomeIcon className="size-4" />
          </TitleBarLink>

          <TitleBarLink
            isActive={isSettingsActive}
            testId="title-bar-settings"
            to="/settings"
          >
            <SettingsIcon className="size-4" />
          </TitleBarLink>
        </div>
      </div>

      <div
        className="flex-1 h-full min-w-90 flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs text-muted-foreground font-medium">
          Pull Panda
        </span>
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
              className="hover:bg-red-500 hover:text-white"
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
    >
      {children}
    </button>
  )
}

interface TitleBarLinkProps {
  children: React.ReactNode
  isActive: boolean
  testId?: string
  to: string
}

function TitleBarLink({
  children,
  isActive,
  testId,
  to
}: TitleBarLinkProps): ReactElement {
  const navigate = useNavigate()

  return (
    <button
      className={cn(
        'w-8 h-full flex items-center justify-center transition-colors',
        isActive
          ? 'text-foreground cursor-default'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      data-testid={testId}
      onClick={() => navigate(to)}
    >
      {children}
    </button>
  )
}
