import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { createContext, useContext, useState, type ReactElement } from 'react'

import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'

interface FileCardContextValue {
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

const FileCardContext = createContext<FileCardContextValue>({
  isCollapsed: false,
  setIsCollapsed: () => {
    // Default no-op
  }
})

interface FileCardProps {
  children?: React.ReactNode | string
  style?: React.CSSProperties
}

export function FileCard({ children, style }: FileCardProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <FileCardContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div
        className={`
          border border-border rounded-md
          text-xs text-foreground font-mono
          overflow-hidden
        `}
        style={style}
      >
        {children}
      </div>
    </FileCardContext.Provider>
  )
}

interface FileCardHeaderProps {
  children?: React.ReactNode | string
}

export function FileCardHeader({
  children
}: FileCardHeaderProps): ReactElement {
  const { isCollapsed, setIsCollapsed } = useContext(FileCardContext)

  const ChevronIcon = isCollapsed ? ChevronRightIcon : ChevronDownIcon

  return (
    <header
      className={cn(
        'flex items-center gap-2 pl-3 pr-4 py-1 border-border cursor-pointer',
        isCollapsed ? 'border-0' : 'border-b'
      )}
      onClick={() => {
        setIsCollapsed(!isCollapsed)
      }}
    >
      <Button
        size="icon"
        variant="ghost"
        className="size-6"
      >
        <ChevronIcon className="size-3 mt-0.5" />
      </Button>
      {children}
    </header>
  )
}

interface FileCardBodyProps {
  children?: React.ReactNode | string
}

export function FileCardBody({
  children
}: FileCardBodyProps): ReactElement | null {
  const { isCollapsed } = useContext(FileCardContext)

  if (isCollapsed) {
    return null
  }

  return <div className="w-full">{children}</div>
}
