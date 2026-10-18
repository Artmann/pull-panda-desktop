import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactElement
} from 'react'

import { cn } from '@/app/lib/utils'

// Called with the position of a task list checkbox, counted in document
// order, when the reader clicks it. `null` keeps the checkboxes read-only.
export type ToggleTaskHandler = (taskIndex: number) => void

export const TaskListContext = createContext<ToggleTaskHandler | null>(null)

type MarkdownInputProps = ComponentProps<'input'> & {
  'data-task-index'?: number | string
}

/**
 * Renders the `input` elements that come out of markdown. Task list
 * checkboxes become clickable when a `TaskListContext` handler is present;
 * anything else renders as it was written.
 */
export function MarkdownInput(props: MarkdownInputProps): ReactElement {
  const onToggleTask = useContext(TaskListContext)
  const taskIndex = props['data-task-index']

  if (props.type !== 'checkbox' || taskIndex === undefined || !onToggleTask) {
    return <input {...props} />
  }

  return (
    <input
      {...props}
      aria-label={props.checked ? 'Mark task as not done' : 'Mark task as done'}
      className={cn(props.className, 'task-checkbox-clickable')}
      disabled={false}
      onChange={() => onToggleTask(Number(taskIndex))}
    />
  )
}
