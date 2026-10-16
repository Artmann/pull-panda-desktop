import { useTheme } from 'next-themes'
import type { CSSProperties, ReactElement } from 'react'
import { memo } from 'react'

import {
  TaskListContext,
  type ToggleTaskHandler
} from '@/app/components/MarkdownInput'
import { renderMarkdown } from '@/app/lib/markdown-cache'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { cn } from '@/app/lib/utils'

export const MarkdownBlock = memo(function MarkdownBlock({
  className,
  content,
  onToggleTask,
  path
}: {
  className?: string
  content: string
  // Makes task list checkboxes clickable. Leave it out to keep them read-only.
  onToggleTask?: ToggleTaskHandler
  path?: string
}): ReactElement {
  const { appTheme } = useAppTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const codeBackground = isDark
    ? appTheme.dark.background
    : appTheme.light.background

  // Parsed during render and memoised across mounts, so the markdown is correct
  // in the very first frame instead of arriving an idle callback later. Code
  // blocks highlight themselves (see `MarkdownCodeBlock`), so a new body is
  // diffed into the mounted tree like any other React update.
  const rendering = renderMarkdown({ content, path })

  return (
    <div
      className={cn(
        'markdown-block w-full max-w-none prose dark:prose-invert [&>:first-child]:mt-0 [&_p]:mb-2 [&_p:last-child]:mb-0',
        className
      )}
      style={{ '--code-bg': codeBackground } as CSSProperties}
    >
      {rendering.element ? (
        <TaskListContext value={onToggleTask ?? null}>
          {rendering.element}
        </TaskListContext>
      ) : (
        <pre className="m-0 whitespace-pre-wrap break-words bg-transparent p-0 font-sans text-sm text-foreground">
          {content}
        </pre>
      )}
    </div>
  )
})
