import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
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
          >
            <ChevronLeftIcon className="size-4" />
          </NavigationButton>

          <NavigationButton
            disabled={!canGoForward}
            onClick={handleForward}
          >
            <ChevronRightIcon className="size-4" />
          </NavigationButton>
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
            <WindowButton onClick={handleMinimize}>
              <MinusIcon className="size-4" />
            </WindowButton>

            <WindowButton onClick={handleMaximize}>
              <SquareIcon className="size-3" />
            </WindowButton>

            <WindowButton
              className="hover:bg-red-500 hover:text-white"
              onClick={handleClose}
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
}

function WindowButton({
  children,
  className,
  onClick
}: WindowButtonProps): ReactElement {
  return (
    <button
      className={cn(
        'w-12 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
        className
      )}
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
}

function NavigationButton({
  children,
  disabled,
  onClick
}: NavigationButtonProps): ReactElement {
  return (
    <button
      className={cn(
        'w-8 h-full flex items-center justify-center transition-colors',
        disabled
          ? 'text-muted-foreground/40 cursor-default'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
