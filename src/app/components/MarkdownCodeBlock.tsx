import {
  isValidElement,
  useEffect,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  ensureLanguageLoaded,
  getLoadedHighlighter,
  getSharedHighlighter,
  resolveLoadedLanguage
} from '@/app/lib/highlighter'
import { scheduleIdleTask } from '@/app/lib/idle-scheduler'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { cn } from '@/app/lib/utils'

interface CodeSource {
  code: string
  language: string
}

interface HighlightedCode {
  className: string
  innerHtml: string
  style: CSSProperties
}

const highlightCacheLimit = 200

const highlightCache = new Map<string, HighlightedCode>()

/**
 * Renders a fenced code block from markdown, highlighted with Shiki.
 *
 * React owns the highlighted markup, so a changed markdown body is diffed into
 * the mounted tree instead of replacing it. Replacing it would destroy every
 * element in the body, including whatever the reader has focus on, and
 * Chromium scrolls the page to the top when that happens.
 */
export function MarkdownCodeBlock({
  children,
  className,
  ...props
}: ComponentProps<'pre'>): ReactElement {
  const { appTheme } = useAppTheme()
  const source = codeSourceOf(children)

  // The grammar a block fell back to after loading, for languages that could
  // not be loaded and so never resolve synchronously.
  const [fallback, setFallback] = useState<{
    language: string
    resolved: string
  } | null>(null)

  const resolvedFallback =
    source && fallback?.language === source.language
      ? fallback.resolved
      : undefined

  const highlighted = source
    ? highlightIfLoaded(
        source,
        resolvedFallback,
        appTheme.lightShikiTheme,
        appTheme.darkShikiTheme
      )
    : null

  const language = source?.language
  const needsGrammar = source !== null && highlighted === null

  // Loading Shiki and its grammars is async; the first block in a language
  // waits for it and re-renders once it is ready.
  useEffect(() => {
    if (!needsGrammar || language === undefined) {
      return
    }

    let isCancelled = false

    const scheduledTask = scheduleIdleTask(() => {
      getSharedHighlighter()
        .then((highlighter) => ensureLanguageLoaded(highlighter, language))
        .then((resolved) => {
          if (!isCancelled) {
            setFallback({ language, resolved })
          }
        })
        .catch((error: unknown) => {
          console.error('Highlighting error:', error)
        })
    })

    return () => {
      isCancelled = true
      scheduledTask.cancel()
    }
  }, [language, needsGrammar])

  if (!highlighted) {
    return (
      <pre
        className={className}
        {...props}
      >
        {children}
      </pre>
    )
  }

  return (
    <pre
      {...props}
      className={cn(className, highlighted.className)}
      dangerouslySetInnerHTML={{ __html: highlighted.innerHtml }}
      style={highlighted.style}
      tabIndex={0}
    />
  )
}

// A fence comes out of rehype as `pre > code.language-*`. Anything else is
// left as it was written.
function codeSourceOf(children: ReactNode): CodeSource | null {
  if (
    !isValidElement<{ children?: ReactNode; className?: unknown }>(children)
  ) {
    return null
  }

  if (children.type !== 'code') {
    return null
  }

  return {
    code: textOf(children.props.children),
    language: languageOf(children.props.className)
  }
}

function languageOf(className: unknown): string {
  const classNames = Array.isArray(className)
    ? className.map(String)
    : String(className ?? '').split(' ')
  const languageClass = classNames.find((name) => name.startsWith('language-'))

  return languageClass?.replace('language-', '') ?? 'text'
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(textOf).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children)
  }

  return ''
}

// Highlight without awaiting anything, so a warm highlighter finishes in the
// same render as the markdown around it. `null` means the async path has to
// load something first.
function highlightIfLoaded(
  source: CodeSource,
  resolvedFallback: string | undefined,
  lightTheme: string,
  darkTheme: string
): HighlightedCode | null {
  const highlighter = getLoadedHighlighter()

  if (!highlighter) {
    return null
  }

  const language =
    resolveLoadedLanguage(highlighter, source.language) ?? resolvedFallback

  if (!language) {
    return null
  }

  const key = [language, lightTheme, darkTheme, source.code].join('\u0000')
  const cached = highlightCache.get(key)

  if (cached) {
    return cached
  }

  const highlighted = splitHighlightedPre(
    highlighter.codeToHtml(source.code, {
      lang: language,
      themes: { dark: darkTheme, light: lightTheme }
    })
  )

  if (!highlighted) {
    return null
  }

  highlightCache.set(key, highlighted)

  if (highlightCache.size > highlightCacheLimit) {
    const oldestKey = highlightCache.keys().next().value

    if (oldestKey !== undefined) {
      highlightCache.delete(oldestKey)
    }
  }

  return highlighted
}

// Shiki returns a whole `pre`. Take it apart so the `pre` React renders can
// carry its class and colours, with the highlighted lines as its contents.
function splitHighlightedPre(html: string): HighlightedCode | null {
  const template = document.createElement('template')

  template.innerHTML = html

  const pre = template.content.firstElementChild

  if (!(pre instanceof HTMLElement)) {
    return null
  }

  return {
    className: pre.className,
    innerHtml: pre.innerHTML,
    style: styleObjectOf(pre.getAttribute('style') ?? '')
  }
}

// Turns `background-color:#fff;--shiki-dark:#000` into a React style object.
function styleObjectOf(style: string): CSSProperties {
  const properties: Record<string, string> = {}

  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':')

    if (separator === -1) {
      continue
    }

    const property = declaration.slice(0, separator).trim()
    const value = declaration.slice(separator + 1).trim()

    if (!property) {
      continue
    }

    const name = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_match, letter: string) =>
          letter.toUpperCase()
        )

    properties[name] = value
  }

  return properties as CSSProperties
}
