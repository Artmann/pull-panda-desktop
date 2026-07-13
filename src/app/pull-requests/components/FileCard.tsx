import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from 'react'

import { Button } from '@/app/components/ui/button'
import { useLazyRender } from '@/app/lib/lazy-render'
import { cn } from '@/app/lib/utils'

interface FileCardContextValue {
  cardRef: RefObject<HTMLDivElement | null>
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

const FileCardContext = createContext<FileCardContextValue>({
  cardRef: { current: null },
  isCollapsed: false,
  setIsCollapsed: () => {
    // Default no-op
  }
})

interface FileCardProps {
  children?: React.ReactNode | string
}

export function FileCard({ children }: FileCardProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const value = useMemo(
    () => ({ cardRef, isCollapsed, setIsCollapsed }),
    [isCollapsed]
  )

  return (
    <FileCardContext.Provider value={value}>
      <div
        ref={cardRef}
        className={`
          border border-border rounded-md bg-card
          text-xs text-foreground font-mono
        `}
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
  const { cardRef, isCollapsed, setIsCollapsed } = useContext(FileCardContext)

  const ChevronIcon = isCollapsed ? ChevronRightIcon : ChevronDownIcon

  return (
    <header
      className={cn(
        // The offset matches the height of the fixed StickyPullRequestHeader
        // (75px) so the pinned header sits flush against it with no seam.
        'flex items-center gap-2 pl-3 pr-4 py-1 border-border cursor-pointer sticky top-[75px] z-10 bg-card rounded-t-md',
        isCollapsed ? 'border-0' : 'border-b'
      )}
      onClick={(event) => {
        const target = event.target as HTMLElement

        if (target.closest('button') && !target.closest('[data-chevron]')) {
          return
        }

        if (!isCollapsed) {
          setIsCollapsed(true)

          requestAnimationFrame(() => {
            const card = cardRef.current
            const scrollContainer = card?.closest('.overflow-auto')

            if (card && scrollContainer instanceof HTMLElement) {
              const cardRect = card.getBoundingClientRect()
              const containerRect = scrollContainer.getBoundingClientRect()

              scrollContainer.scrollTop += cardRect.top - containerRect.top - 75
            }
          })

          return
        }

        setIsCollapsed(false)
      }}
    >
      <Button
        data-chevron
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
  eager?: boolean
  fallback?: React.ReactNode
  lazy?: boolean
}

export function FileCardBody({
  children,
  eager = false,
  fallback = null,
  lazy = false
}: FileCardBodyProps): ReactElement | null {
  const { isCollapsed } = useContext(FileCardContext)
  const { ref, shouldRender } = useLazyRender<HTMLDivElement>({
    eager: eager || !lazy,
    enabled: lazy
  })

  if (isCollapsed) {
    return null
  }

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-b-md"
    >
      {shouldRender ? children : fallback}
    </div>
  )
}
