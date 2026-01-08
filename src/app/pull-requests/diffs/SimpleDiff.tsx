import { memo, useMemo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

import { parseDiffHunk } from './hunks'
import { applyIntraLineDiffHighlighting } from './intra-line-diff'

interface SimpleDiffProps {
  diffHunk: string
  lineEnd?: number
  lineStart?: number
}

export const SimpleDiff = memo(function SimpleDiff({
  diffHunk,
  lineEnd,
  lineStart
}: SimpleDiffProps): ReactElement {
  const hunk = useMemo(() => parseDiffHunk(diffHunk), [diffHunk])

  const filteredLines = useMemo(() => {
    if (lineStart === undefined && lineEnd === undefined) {
      return hunk.lines
    }

    return hunk.lines.filter((line) => {
      const lineNumber = line.oldLineNumber ?? line.newLineNumber

      if (lineNumber === null || lineNumber === undefined) {
        return true
      }

      const start = lineStart ?? 0
      const end = lineEnd ?? Infinity

      return lineNumber >= start && lineNumber <= end
    })
  }, [hunk.lines, lineStart, lineEnd])

  const intraLineDiffMap = useMemo(
    () => applyIntraLineDiffHighlighting(filteredLines),
    [filteredLines]
  )

  const highlightedLines = useMemo(() => {
    return filteredLines.map((line, index) => {
      const intraLineDiff = intraLineDiffMap.get(index)
      if (intraLineDiff) {
        return intraLineDiff
      }

      return escapeHtml(line.content)
    })
  }, [filteredLines, intraLineDiffMap])

  if (filteredLines.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No lines found in the specified range
      </div>
    )
  }

  return (
    <div className="diff-table w-full font-mono font-normal antialiased text-xs leading-6">
      {filteredLines.map((line, index) => {
        const key = line.newLineNumber
          ? `new-${String(line.newLineNumber)}`
          : line.oldLineNumber
            ? `old-${String(line.oldLineNumber)}`
            : `idx-${String(index)}`

        return (
          <DiffLine
            key={key}
            filteredLines={filteredLines}
            highlightedLines={highlightedLines}
            index={index}
            line={line}
          />
        )
      })}
    </div>
  )
})

const blankSpace = '\u00A0'

const DiffLine = memo(function DiffLine({
  filteredLines,
  highlightedLines,
  index,
  line
}: {
  filteredLines: ReturnType<typeof parseDiffHunk>['lines']
  highlightedLines: string[]
  index: number
  line: ReturnType<typeof parseDiffHunk>['lines'][number]
}) {
  const getLineColor = (index: number) => {
    if (filteredLines.length === 0) {
      return getLineColorByType('context')
    }

    const clampedIndex = Math.min(
      Math.max(index, 0),
      filteredLines.length - 1
    )

    const currentLine = filteredLines[clampedIndex]

    return getLineColorByType(currentLine.type)
  }

  const wasAdded = line.type === 'add'
  const wasRemoved = line.type === 'remove'

  return (
    <div
      className="flex gap-0"
      data-testid={`diff-line-${index}`}
    >
      <div className={cn('text-right user-select-none')}>
        <div
          className={cn(
            'px-3',
            'border-l-3',
            wasAdded
              ? 'border-l-[#5CC9B6]'
              : wasRemoved
                ? 'border-l-[#D46060]'
                : 'border-l-transparent',
            getLineColor(index)
          )}
        >
          {line.type === 'truncated'
            ? blankSpace
            : wasRemoved
              ? line.oldLineNumber ?? blankSpace
              : line.newLineNumber ?? blankSpace}
        </div>
      </div>

      <div
        className={cn(
          'flex-1 min-w-0 overflow-x-auto w-full pr-4',
          getLineColor(index)
        )}
      >
        <span
          className={cn(
            'block wrap-anywhere whitespace-pre-wrap',
            line.type === 'truncated' &&
              'italic text-muted-foreground text-center'
          )}
          dangerouslySetInnerHTML={{
            __html: highlightedLines[index]
          }}
        />
      </div>
    </div>
  )
})

function getLineColorByType(
  type: 'add' | 'remove' | 'context' | 'truncated'
): string {
  if (type === 'add') {
    return cn('bg-[#E9FBED] dark:bg-[#1a3d2a]')
  }

  if (type === 'remove') {
    return cn('bg-[#FFEBEA] dark:bg-[#3d1a1a]')
  }

  if (type === 'truncated') {
    return cn('bg-muted/30')
  }

  return cn('bg-background')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
