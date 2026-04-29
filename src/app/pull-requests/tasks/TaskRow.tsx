import { CheckIcon, ChevronDownIcon, ExternalLinkIcon } from 'lucide-react'
import { useState, type ReactElement } from 'react'

import type { PullRequest } from '@/types/pull-request'

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'

import { CheckExpansion } from './expansions/CheckExpansion'
import { RequirementExpansion } from './expansions/RequirementExpansion'
import { ReviewStateExpansion } from './expansions/ReviewStateExpansion'
import { ThreadExpansion } from './expansions/ThreadExpansion'
import { SeverityChip } from './SeverityChip'
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

export function TaskRow({
  defaultOpen = false,
  pullRequest,
  task
}: TaskRowProps): ReactElement {
  const expandable = task.kind !== 'simple'
  const isDone = task.severity === 'done'

  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'border-t border-border first:border-t-0',
        isDone && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div
          aria-hidden
          className={cn(
            'w-[3px] self-stretch shrink-0 rounded-full',
            severityBarClassNames[task.severity]
          )}
        />

        <div
          className={cn('min-w-0 flex-1', expandable && 'cursor-pointer')}
          onClick={() => {
            if (expandable) {
              setIsOpen((value) => !value)
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={task.severity} />

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
            <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {task.meta}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {task.action?.url && !isDone && (
            <Button
              onClick={(event) => {
                event.stopPropagation()

                if (task.action?.url) {
                  window.electron.openUrl(task.action.url)
                }
              }}
              size="sm"
              variant="outline"
            >
              <ExternalLinkIcon className="size-3" />
              {task.action.label}
            </Button>
          )}

          {expandable && (
            <Button
              aria-label={isOpen ? 'Collapse task' : 'Expand task'}
              onClick={(event) => {
                event.stopPropagation()
                setIsOpen((value) => !value)
              }}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronDownIcon
                className={cn(
                  'size-3.5 transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </Button>
          )}

          {isDone && (
            <span className="flex size-5 items-center justify-center rounded-sm bg-status-success-foreground text-background">
              <CheckIcon className="size-3" />
            </span>
          )}
        </div>
      </div>

      {isOpen && expandable && (
        <div className="px-3.5 pb-3 pl-[42px]">
          <TaskExpansion
            pullRequest={pullRequest}
            task={task}
          />
        </div>
      )}
    </div>
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

  if (task.kind === 'thread') {
    return (
      <ThreadExpansion
        pullRequest={pullRequest}
        task={task}
      />
    )
  }

  return null
}
