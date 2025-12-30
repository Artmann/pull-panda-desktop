import { MinusIcon, SquareIcon, XIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

const isMac = navigator.platform.toLowerCase().includes('mac')

export function TitleBar(): ReactElement {
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
        className="flex-1 h-full flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs text-muted-foreground font-medium">
          Pull Panda
        </span>
      </div>

      {!isMac && (
        <div className="flex h-full">
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
