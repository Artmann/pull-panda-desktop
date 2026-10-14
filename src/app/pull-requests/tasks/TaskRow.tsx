import { ChevronDownIcon } from 'lucide-react'
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

import {
  StatusCircle,
  type StatusCircleState
} from '@/app/components/StatusCircle'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'

import { ResolveThreadButton } from '../components/CommentThread'
import { ReviewerPicker } from '../ReviewerPicker'
import { CheckExpansion } from './expansions/CheckExpansion'
import { RequirementExpansion } from './expansions/RequirementExpansion'
import { ReviewStateExpansion } from './expansions/ReviewStateExpansion'
import { ThreadExpansion } from './expansions/ThreadExpansion'
import type { Severity, Task, TaskAction } from './task-types'

interface TaskRowProps {
  defaultOpen?: boolean
  pullRequest: PullRequest
  task: Task
}

const animationDurationMs = 200

function getStatusCircleState(task: Task): StatusCircleState {
  if (task.status === 'running') {
    return 'running'
  }

  if (task.status === 'pending') {
    return 'neutral'
  }

  const states: Record<Severity, StatusCircleState> = {
    blocker: 'failure',
    done: 'success',
    info: 'neutral',
    warning: 'warning'
  }

  return states[task.severity]
}

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
        'border-t border-border first:border-t-0 first:rounded-t-lg last:rounded-b-lg',
        // Rows clip to the card's corners, except the one holding the
        // reviewer picker, whose menu has to hang out of the card.
        task.action?.type !== 'assign-reviewers' && 'overflow-hidden'
      )}
    >
      <ExpandableSection isOpen={!isThreadOpen}>
        <CollapsedRowBody
          bodyClickable={bodyClickable}
          collapseButton={collapseButton}
          isDone={isDone}
          onToggle={handleToggle}
          pullRequest={pullRequest}
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
          <div className="flex gap-3 px-3.5 pb-3 pt-0.5">
            <div
              aria-hidden
              className="w-4.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
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
  pullRequest: PullRequest
  task: Task
}

function CollapsedRowBody({
  bodyClickable,
  collapseButton,
  isDone,
  onToggle,
  pullRequest,
  task
}: CollapsedRowBodyProps): ReactElement {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <StatusCircle
        label={statusLabels[getStatusCircleState(task)]}
        state={getStatusCircleState(task)}
      />

      <div
        className={cn('min-w-0 flex-1', bodyClickable && 'cursor-pointer')}
        onClick={bodyClickable ? onToggle : undefined}
      >
        <CollapsedHeader
          isDone={isDone}
          task={task}
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {task.action && (
          <TaskActionButton
            action={task.action}
            pullRequest={pullRequest}
            task={task}
          />
        )}

        {collapseButton}
      </div>
    </div>
  )
}

const statusLabels: Record<StatusCircleState, string> = {
  failure: 'Blocking',
  neutral: 'Open',
  running: 'In progress',
  success: 'Done',
  warning: 'Warning'
}

function TaskActionButton({
  action,
  pullRequest,
  task
}: {
  action: TaskAction
  pullRequest: PullRequest
  task: Task
}): ReactElement | null {
  if (action.type === 'assign-reviewers') {
    return (
      <ReviewerPicker
        pullRequest={pullRequest}
        variant="button"
      />
    )
  }

  if (action.type === 'resolve-thread') {
    if (task.kind !== 'thread' || !task.thread) {
      return null
    }

    return (
      <div
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <ResolveThreadButton
          appearance="compact"
          pullRequest={pullRequest}
          thread={task.thread}
        />
      </div>
    )
  }

  return (
    <Button
      onClick={(event) => {
        event.stopPropagation()
        window.electron.openUrl(action.url)
      }}
      size="xs"
      variant="outline"
    >
      {action.label}
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
  return (
    <>
      <div
        className={cn(
          'truncate text-sm font-medium leading-snug',
          isDone ? 'text-foreground/75' : 'text-foreground'
        )}
      >
        {task.title}
      </div>

      {task.meta && (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
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
