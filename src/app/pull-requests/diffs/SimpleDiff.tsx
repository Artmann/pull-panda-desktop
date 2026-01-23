import { Plus } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'

import {
  getLanguageFromPath,
  getSharedHighlighter,
  themes
} from '@/app/lib/highlighter'
import { cn, escapeHtml } from '@/app/lib/utils'
import type { PendingReviewComment } from '@/app/store/pending-review-comments-slice'
import type { Comment } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { getLinePosition, parseDiffHunk, type DiffHunkLine } from './hunks'
import { InlineCommentInput } from './InlineCommentInput'
import { applyIntraLineDiffHighlighting } from './intra-line-diff'
import { PendingComment } from './PendingComment'
import { SubmittedComment } from './SubmittedComment'
import { Button } from '@/app/components/ui/button'

async function highlightLines(
  lines: DiffHunkLine[],
  language: string,
  intraLineDiffMap: Map<number, string>
): Promise<Map<number, string>> {
  const highlighter = await getSharedHighlighter()
  const loadedLangs = highlighter.getLoadedLanguages()
  const effectiveLang = loadedLangs.includes(language) ? language : 'text'

  if (effectiveLang === 'text') {
    return new Map()
  }

  const result = new Map<number, string>()

  for (let i = 0; i < lines.length; i++) {
    // Skip lines that have intra-line diff highlighting
    if (intraLineDiffMap.has(i)) {
      continue
    }

    const line = lines[i]

    if (line.type === 'truncated') {
      continue
    }

    // Use codeToHtml and extract the inner content
    const html = highlighter.codeToHtml(line.content, {
      lang: effectiveLang,
      themes: {
        light: themes.light,
        dark: themes.dark
      }
    })

    // Extract content from <pre><code>...</code></pre>
    const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)
    const innerHtml = codeMatch ? codeMatch[1] : escapeHtml(line.content)

    result.set(i, innerHtml)
  }

  return result
}

interface SimpleDiffProps {
  diffHunk: string
  filePath?: string
  lineEnd?: number
  lineStart?: number
  pendingComments?: PendingReviewComment[]
  pullRequest?: PullRequest
  submittedComments?: Comment[]
}

export const SimpleDiff = memo(function SimpleDiff({
  diffHunk,
  filePath,
  lineEnd,
  lineStart,
  pendingComments = [],
  pullRequest,
  submittedComments = []
}: SimpleDiffProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [syntaxHighlightedLines, setSyntaxHighlightedLines] = useState<
    Map<number, string>
  >(new Map())
  const [activeCommentLineIndex, setActiveCommentLineIndex] = useState<
    number | null
  >(null)

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

  // Apply syntax highlighting lazily when component becomes visible
  useEffect(() => {
    if (!filePath || filteredLines.length === 0) {
      return
    }

    const language = getLanguageFromPath(filePath)

    if (!language) {
      return
    }

    const container = containerRef.current

    if (!container) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void highlightLines(filteredLines, language, intraLineDiffMap).then(
            (highlighted) => {
              setSyntaxHighlightedLines(highlighted)
            }
          )
          observer.disconnect()
        }
      },
      { rootMargin: '500px 0px' }
    )

    observer.observe(container)

    return () => observer.disconnect()
  }, [filePath, filteredLines, intraLineDiffMap])

  const highlightedLines = useMemo(() => {
    return filteredLines.map((line, index) => {
      // Intra-line diff takes precedence (word-level highlighting)
      const intraLineDiff = intraLineDiffMap.get(index)

      if (intraLineDiff) {
        return intraLineDiff
      }

      // Use syntax highlighting if available
      const syntaxHighlighted = syntaxHighlightedLines.get(index)

      if (syntaxHighlighted) {
        return syntaxHighlighted
      }

      // Fallback to escaped plain text
      return escapeHtml(line.content)
    })
  }, [filteredLines, intraLineDiffMap, syntaxHighlightedLines])

  const handleLineClick = useCallback(
    (index: number) => {
      if (!pullRequest || !filePath) {
        return
      }

      const line = filteredLines[index]

      if (line.type === 'truncated') {
        return
      }

      setActiveCommentLineIndex(index)
    },
    [pullRequest, filePath, filteredLines]
  )

  const handleCloseComment = useCallback(() => {
    setActiveCommentLineIndex(null)
  }, [])

  const getPendingCommentsForLine = useCallback(
    (line: DiffHunkLine) => {
      const position = getLinePosition(line)

      if (!position || !filePath) {
        return []
      }

      return pendingComments.filter(
        (comment) =>
          comment.path === filePath &&
          comment.line === position.line &&
          comment.side === position.side
      )
    },
    [pendingComments, filePath]
  )

  const getSubmittedCommentsForLine = useCallback(
    (line: DiffHunkLine) => {
      const position = getLinePosition(line)

      if (!position || !filePath) {
        return []
      }

      return submittedComments.filter((comment) => {
        if (comment.path !== filePath) {
          return false
        }

        // For LEFT side (removed lines), check originalLine
        // For RIGHT side (added/context lines), check line
        if (position.side === 'LEFT') {
          return comment.originalLine === position.line
        }

        return comment.line === position.line
      })
    },
    [submittedComments, filePath]
  )

  if (filteredLines.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No lines found in the specified range
      </div>
    )
  }

  const canComment = Boolean(pullRequest && filePath)

  return (
    <div
      ref={containerRef}
      className="diff-table w-full font-mono font-normal antialiased text-xs leading-6 bg-muted rounded-lg overflow-hidden"
    >
      {filteredLines.map((line, index) => {
        const key = line.newLineNumber
          ? `new-${String(line.newLineNumber)}`
          : line.oldLineNumber
            ? `old-${String(line.oldLineNumber)}`
            : `idx-${String(index)}`

        const linePendingComments = getPendingCommentsForLine(line)
        const lineSubmittedComments = getSubmittedCommentsForLine(line)
        const isActiveCommentLine = activeCommentLineIndex === index
        const canCommentOnLine =
          canComment && line.type !== 'truncated' && getLinePosition(line)

        return (
          <div key={key}>
            <DiffLine
              canComment={Boolean(canCommentOnLine)}
              filteredLines={filteredLines}
              highlightedLines={highlightedLines}
              index={index}
              line={line}
              onClick={() => handleLineClick(index)}
            />

            {lineSubmittedComments.map((comment) => (
              <SubmittedComment
                key={comment.id}
                comment={comment}
              />
            ))}

            {linePendingComments.map((comment) => (
              <PendingComment
                key={comment.id}
                comment={comment}
                pullRequestId={pullRequest?.id ?? ''}
              />
            ))}

            {isActiveCommentLine && pullRequest && filePath && (
              <InlineCommentInput
                filePath={filePath}
                line={line}
                onCancel={handleCloseComment}
                pullRequest={pullRequest}
              />
            )}
          </div>
        )
      })}
    </div>
  )
})

const blankSpace = '\u00A0'

const DiffLine = memo(function DiffLine({
  canComment,
  filteredLines,
  highlightedLines,
  index,
  line,
  onClick
}: {
  canComment: boolean
  filteredLines: ReturnType<typeof parseDiffHunk>['lines']
  highlightedLines: string[]
  index: number
  line: ReturnType<typeof parseDiffHunk>['lines'][number]
  onClick: () => void
}) {
  const getLineColor = (lineIndex: number) => {
    if (filteredLines.length === 0) {
      return getLineColorByType('context')
    }

    const clampedIndex = Math.min(
      Math.max(lineIndex, 0),
      filteredLines.length - 1
    )

    const currentLine = filteredLines[clampedIndex]

    return getLineColorByType(currentLine.type)
  }

  const wasAdded = line.type === 'add'
  const wasRemoved = line.type === 'remove'

  return (
    <div
      className="flex gap-0 group relative"
      data-testid={`diff-line-${index}`}
    >
      <div className={cn('text-right user-select-none relative')}>
        {canComment && (
          <Button
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity size-5 flex items-center justify-center cursor-pointer"
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={onClick}
          >
            <Plus className="size-3" />
          </Button>
        )}

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
              ? (line.oldLineNumber ?? blankSpace)
              : (line.newLineNumber ?? blankSpace)}
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
    return cn('bg-muted/50')
  }

  return cn('bg-transparent')
}
