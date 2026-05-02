import {
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  Loader2Icon
} from 'lucide-react'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject
} from 'react'

import type { PullRequest } from '@/types/pull-request'

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'

import { CheckExpansion } from './expansions/CheckExpansion'
import { RequirementExpansion } from './expansions/RequirementExpansion'
import { ReviewStateExpansion } from './expansions/ReviewStateExpansion'
import { ThreadExpansion } from './expansions/ThreadExpansion'
import type { Severity, Task } from './task-types'

interface TaskRowProps {
  defaultOpen?: boolean
  pullRequest: PullRequest
  task: Task
}

const severityBarClassNames: Record<Severity, string> = {
  blocker: 'bg-status-danger-foreground/85',
  done: 'bg-status-success-foreground/40',
  info: 'bg-muted-foreground/60',
  warning: 'bg-status-warning-foreground/85'
}

const animationDurationMs = 200

export function TaskRow({
  defaultOpen = false,
  pullRequest,
  task
}: TaskRowProps): ReactElement {
  const expandable = task.kind !== 'simple'
  const isDone = task.severity === 'done'
  const isThread = task.kind === 'thread'

  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [hasBeenOpened, setHasBeenOpened] = useState(defaultOpen)

  const rowRef = useRef<HTMLDivElement>(null)
  useScrollAnchoredCollapse(rowRef, isOpen)

  const handleToggle = useCallback(() => {
    setIsOpen((value) => {
      if (!value) {
        setHasBeenOpened(true)
      }

      return !value
    })
  }, [])

  const isThreadOpen = isThread && isOpen
  const renderInlineExpansion = isThread && (isOpen || hasBeenOpened)
  const renderAppendedExpansion =
    !isThread && expandable && (isOpen || hasBeenOpened)
  const bodyClickable = expandable && !isThreadOpen

  const collapseButton = expandable && (
    <CollapseButton
      isOpen={isOpen}
      onToggle={handleToggle}
    />
  )

  return (
    <div
      ref={rowRef}
      className={cn(
        'border-t border-border first:border-t-0',
        isDone && !isOpen && 'opacity-60'
      )}
    >
      <ExpandableSection isOpen={!isThreadOpen}>
        <CollapsedRowBody
          bodyClickable={bodyClickable}
          collapseButton={collapseButton}
          isDone={isDone}
          onToggle={handleToggle}
          task={task}
        />
      </ExpandableSection>

      {renderInlineExpansion && task.kind === 'thread' && (
        <ExpandableSection isOpen={isThreadOpen}>
          <div className="relative border-y-2 border-border bg-muted/30">
            <ThreadExpansion
              pullRequest={pullRequest}
              task={task}
            />

            <div className="absolute right-3.5 top-1">{collapseButton}</div>
          </div>
        </ExpandableSection>
      )}

      {renderAppendedExpansion && (
        <ExpandableSection isOpen={isOpen}>
          <div className="flex gap-3 px-3.5 pb-3 pt-1">
            <div
              aria-hidden
              className="w-0.75 shrink-0"
            />

            <div className="min-w-0 flex-1 pl-2">
              <TaskExpansion
                pullRequest={pullRequest}
                task={task}
              />
            </div>
          </div>
        </ExpandableSection>
      )}
    </div>
  )
}

function useScrollAnchoredCollapse(
  rowRef: RefObject<HTMLDivElement | null>,
  isOpen: boolean
): void {
  const isMountedRef = useRef(false)

  useLayoutEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }

    if (isOpen) {
      return
    }

    const element = rowRef.current

    if (!element) {
      return
    }

    const scroller = findScrollableAncestor(element)

    if (!scroller) {
      return
    }

    let lastHeight = element.offsetHeight

    const observer = new ResizeObserver(() => {
      const newHeight = element.offsetHeight
      const delta = newHeight - lastHeight

      if (Math.abs(delta) > 0.5) {
        scroller.scrollTop += delta
        lastHeight = newHeight
      }
    })

    observer.observe(element)

    const timer = window.setTimeout(() => {
      observer.disconnect()
    }, animationDurationMs + 50)

    return (): void => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [isOpen, rowRef])
}

interface CollapseButtonProps {
  isOpen: boolean
  onToggle: () => void
}

function CollapseButton({
  isOpen,
  onToggle
}: CollapseButtonProps): ReactElement {
  return (
    <button
      aria-label={isOpen ? 'Collapse task' : 'Expand task'}
      className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      type="button"
    >
      <ChevronDownIcon
        className={cn('size-3.5 transition-transform', isOpen && 'rotate-180')}
      />
    </button>
  )
}

interface CollapsedRowBodyProps {
  bodyClickable: boolean
  collapseButton: ReactNode
  isDone: boolean
  onToggle: () => void
  task: Task
}

function CollapsedRowBody({
  bodyClickable,
  collapseButton,
  isDone,
  onToggle,
  task
}: CollapsedRowBodyProps): ReactElement {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <div
        aria-hidden
        className={cn(
          'w-0.75 self-stretch shrink-0 rounded-full',
          severityBarClassNames[task.severity]
        )}
      />

      <div
        className={cn('min-w-0 flex-1 pl-2', bodyClickable && 'cursor-pointer')}
        onClick={bodyClickable ? onToggle : undefined}
      >
        <CollapsedHeader
          isDone={isDone}
          task={task}
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {task.action?.url && !isDone && <TaskActionButton task={task} />}

        {collapseButton}

        {isDone && (
          <span className="flex size-5 items-center justify-center rounded-sm bg-status-success-foreground text-background">
            <CheckIcon className="size-3" />
          </span>
        )}
      </div>
    </div>
  )
}

function TaskActionButton({ task }: { task: Task }): ReactElement {
  return (
    <Button
      onClick={(event) => {
        event.stopPropagation()

        if (task.action?.url) {
          window.electron.openUrl(task.action.url)
        }
      }}
      size="xs"
      variant="outline"
    >
      <ExternalLinkIcon className="size-3" />
      {task.action?.label}
    </Button>
  )
}

interface ExpandableSectionProps {
  children: ReactNode
  isOpen: boolean
}

function ExpandableSection({
  children,
  isOpen
}: ExpandableSectionProps): ReactElement {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none',
        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement

  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY

    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay'
    ) {
      return current
    }

    current = current.parentElement
  }

  return null
}

interface CollapsedHeaderProps {
  isDone: boolean
  task: Task
}

function CollapsedHeader({ isDone, task }: CollapsedHeaderProps): ReactElement {
  const isRunning = task.status === 'running'

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {isRunning ? (
          <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}

        {task.authorLogin && (
          <Avatar className="size-4">
            <AvatarImage
              alt={task.authorLogin}
              src={task.authorAvatarUrl ?? undefined}
            />
            <AvatarFallback className="text-[9px] uppercase">
              {task.authorLogin.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        )}

        <span
          className={cn(
            'text-sm font-medium leading-snug',
            isDone && 'line-through decoration-muted-foreground/60'
          )}
        >
          {task.title}
        </span>
      </div>

      {task.meta && (
        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground pt-1">
          {task.meta}
        </div>
      )}
    </>
  )
}

interface TaskExpansionProps {
  pullRequest: PullRequest
  task: Task
}

function TaskExpansion({
  pullRequest,
  task
}: TaskExpansionProps): ReactElement | null {
  if (task.kind === 'check') {
    return <CheckExpansion task={task} />
  }

  if (task.kind === 'requirement') {
    return (
      <RequirementExpansion
        pullRequest={pullRequest}
        task={task}
      />
    )
  }

  if (task.kind === 'review-state') {
    return <ReviewStateExpansion task={task} />
  }

  return null
}
