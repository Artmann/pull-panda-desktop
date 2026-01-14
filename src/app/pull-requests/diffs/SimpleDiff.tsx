import {
  memo,
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

import { parseDiffHunk, type DiffHunkLine } from './hunks'
import { applyIntraLineDiffHighlighting } from './intra-line-diff'

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
}

export const SimpleDiff = memo(function SimpleDiff({
  diffHunk,
  filePath,
  lineEnd,
  lineStart
}: SimpleDiffProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [syntaxHighlightedLines, setSyntaxHighlightedLines] = useState<
    Map<number, string>
  >(new Map())

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

  if (filteredLines.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No lines found in the specified range
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="diff-table w-full font-mono font-normal antialiased text-xs leading-6"
    >
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

    const clampedIndex = Math.min(Math.max(index, 0), filteredLines.length - 1)

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
    return cn('bg-muted/30')
  }

  return cn('bg-background')
}
