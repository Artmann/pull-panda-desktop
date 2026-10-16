import { memo, type ReactElement } from 'react'

import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import type { ToggleTaskHandler } from '@/app/components/MarkdownInput'

interface CommentBodyProps {
  content: string
  onToggleTask?: ToggleTaskHandler
  path?: string
}

export const CommentBody = memo(function CommentBody({
  content,
  onToggleTask,
  path
}: CommentBodyProps): ReactElement {
  const formattedContent = normalizeMarkdownContent(content)

  return (
    <MarkdownBlock
      className="w-full max-w-full prose-sm prose-headings:mt-2 prose-headings:mb-2 prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-h4:text-sm"
      content={formattedContent}
      onToggleTask={onToggleTask}
      path={path}
    />
  )
})

function normalizeMarkdownContent(content: string): string {
  // First, normalize all line endings to \n
  let normalized = content.replaceAll(/\r\n/g, '\n').replaceAll(/\r/g, '\n')

  // Clean up excessive blank lines (max 2 consecutive)
  normalized = normalized.replaceAll(/\n{3,}/g, '\n\n')

  return normalized
}
