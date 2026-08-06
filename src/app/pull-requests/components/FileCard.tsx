import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from 'react'

import { Button } from '@/app/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
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
  const [isStuck, setIsStuck] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // The header keeps the card's rounded top corners while at rest, but once
  // it pins below the sticky pull-request header the transparent corner
  // notches would let the scrolling diff content peek through. Watch a
  // sentinel placed at the header's resting position and square the corners
  // while pinned.
  useEffect(function trackStuckState() {
    const sentinel = sentinelRef.current

    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return
    }

    const scrollRoot = sentinel.closest('.overflow-auto')

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting)
      },
      {
        root: scrollRoot instanceof HTMLElement ? scrollRoot : null,
        // Only leaving through the TOP counts as pinned: the top margin
        // matches the sticky offset, and the huge bottom margin keeps
        // sentinels below the viewport "intersecting" so off-screen cards
        // are not treated as stuck.
        rootMargin: '-76px 0px 100000px 0px'
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [])

  const ChevronIcon = isCollapsed ? ChevronRightIcon : ChevronDownIcon

  return (
    <>
      <div
        aria-hidden
        className="h-px -mb-px"
        ref={sentinelRef}
      />
      <header
        className={cn(
          // The offset matches the height of the fixed StickyPullRequestHeader
          // (the sticky-header spacing token) so the pinned header sits flush
          // against it with no seam.
          'flex items-center gap-2 pl-3 pr-4 py-1 border-border cursor-pointer sticky top-sticky-header z-10 bg-card',
          isStuck ? 'rounded-t-none' : 'rounded-t-md',
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

                scrollContainer.scrollTop +=
                  cardRect.top - containerRect.top - 75
              }
            })

            return
          }

          setIsCollapsed(false)
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isCollapsed ? 'Expand file' : 'Collapse file'}
              data-chevron
              size="icon-xs"
              variant="ghost"
            >
              <ChevronIcon className="size-3" />
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            {isCollapsed ? 'Expand file' : 'Collapse file'}
          </TooltipContent>
        </Tooltip>
        {children}
      </header>
    </>
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
