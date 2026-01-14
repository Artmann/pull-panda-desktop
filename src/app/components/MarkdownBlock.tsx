import type { Element, Root } from 'hast'
import isString from 'lodash/isString'
import type { ReactElement } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import rehypeReact, { type Options as RehypeReactOptions } from 'rehype-react'
import remarkGfm from 'remark-gfm'
import remarkParse, { type Options as RemarkParseOptions } from 'remark-parse'
import rehypeRaw from 'rehype-raw'
import remarkRehype, {
  type Options as RemarkRehypeOptions
} from 'remark-rehype'
import { type Plugin, unified } from 'unified'
import { visit } from 'unist-util-visit'

import { Skeleton } from './ui/skeleton'

import {
  getLanguageFromPath,
  getSharedHighlighter,
  themes
} from '@/app/lib/highlighter'
import { cn } from '@/app/lib/utils'

// Highlight code blocks in the DOM when they come into view
async function highlightCodeBlocks(container: HTMLElement): Promise<void> {
  const codeBlocks = container.querySelectorAll('pre > code')

  if (codeBlocks.length === 0) {
    return
  }

  const highlighter = await getSharedHighlighter()

  for (const codeElement of codeBlocks) {
    const preElement = codeElement.parentElement

    if (!preElement) {
      continue
    }

    // Skip if already highlighted
    if (preElement.classList.contains('shiki')) {
      continue
    }

    const code = codeElement.textContent ?? ''

    // Detect language from class name (e.g., "language-typescript")
    const langClass = Array.from(codeElement.classList).find((c) =>
      c.startsWith('language-')
    )
    const lang = langClass?.replace('language-', '') ?? 'text'

    // Check if language is supported, fallback to text
    const loadedLangs = highlighter.getLoadedLanguages()
    const effectiveLang = loadedLangs.includes(lang) ? lang : 'text'

    const highlighted = highlighter.codeToHtml(code, {
      lang: effectiveLang,
      themes: {
        light: themes.light,
        dark: themes.dark
      }
    })

    // Replace the pre element with highlighted HTML
    const wrapper = document.createElement('div')
    wrapper.innerHTML = highlighted
    const newPre = wrapper.firstElementChild

    if (newPre) {
      preElement.replaceWith(newPre)
    }
  }
}

export const MarkdownBlock = memo(function MarkdownBlock({
  className,
  content,
  path
}: {
  className?: string
  content: string
  path?: string
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [result, createMarkdownContent] = useRemark({ path })
  const [isHighlighted, setIsHighlighted] = useState(false)
  const lastContentRef = useRef<string | null>(null)

  // Parse markdown without syntax highlighting
  useEffect(() => {
    // Only re-parse if content actually changed
    if (lastContentRef.current === content) {
      return
    }
    lastContentRef.current = content
    createMarkdownContent(content)
    setIsHighlighted(false) // Reset when content changes
  }, [content, createMarkdownContent])

  // Lazy syntax highlighting with Intersection Observer
  useEffect(() => {
    if (!result || isHighlighted || !containerRef.current) {
      return
    }

    const container = containerRef.current

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && container) {
          highlightCodeBlocks(container).then(() => {
            setIsHighlighted(true)
          })
          observer.disconnect()
        }
      },
      { rootMargin: '500px 0px' }
    )

    observer.observe(container)

    return () => observer.disconnect()
  }, [result, isHighlighted])

  return (
    <div
      ref={containerRef}
      className={cn(
        'markdown-block w-full max-w-none prose dark:prose-invert [&>:first-child]:mt-0',
        className
      )}
    >
      {result ? (
        result
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      )}
    </div>
  )
})

interface UseRemarkOptions {
  path?: string
  rehypeReactOptions?: Pick<RehypeReactOptions, 'components'>
  remarkParseOptions?: RemarkParseOptions
  remarkRehypeOptions?: RemarkRehypeOptions
  onError?: (error: Error) => void
}

const defaultOnError = (error: Error) => console.error('Markdown error:', error)

function useRemark({
  path,
  rehypeReactOptions,
  remarkParseOptions,
  remarkRehypeOptions,
  onError = defaultOnError
}: UseRemarkOptions = {}): [ReactElement | null, (source: string) => void] {
  const [content, setContent] = useState<ReactElement | null>(null)

  const rehypeDetectLanguageFromPath: Plugin<[], Root> = useCallback(() => {
    return (tree: Root) => {
      visit(tree, 'element', (node: Element) => {
        if (node.tagName !== 'code') {
          return
        }

        if (!node.properties) {
          return
        }

        if (!node.properties.className) {
          return
        }

        const suggestedLanguage = getLanguageFromPath(path)

        if (!suggestedLanguage) {
          return
        }

        const newClassName = `language-${suggestedLanguage}`

        if (isString(node.properties.className)) {
          node.properties.className = `${node.properties.className} ${newClassName}`
        }

        if (Array.isArray(node.properties.className)) {
          const suggestionClassIndex = node.properties.className.indexOf(
            'language-suggestion'
          )

          if (suggestionClassIndex !== -1) {
            node.properties.className[suggestionClassIndex] = newClassName
          } else {
            node.properties.className.push(newClassName)
          }
        }
      })
    }
  }, [path])

  // Parse markdown WITHOUT syntax highlighting for fast initial render
  const createMarkdown = useCallback(
    (source: string) => {
      void (async () => {
        try {
          const file = await unified()
            .use(remarkParse, remarkParseOptions)
            .use([remarkGfm])
            .use(remarkRehype, {
              ...remarkRehypeOptions,
              allowDangerousHtml: true
            })
            .use(rehypeRaw)
            .use(rehypeDetectLanguageFromPath)
            .use(rehypeReact, {
              ...rehypeReactOptions,
              Fragment: jsxRuntime.Fragment,
              jsx: jsxRuntime.jsx,
              jsxs: jsxRuntime.jsxs
            } satisfies RehypeReactOptions)
            .process(source)

          setContent(file.result as ReactElement)
        } catch (error) {
          onError(error as Error)
        }
      })()
    },
    [
      remarkParseOptions,
      remarkRehypeOptions,
      rehypeDetectLanguageFromPath,
      rehypeReactOptions,
      onError
    ]
  )

  return [content, createMarkdown]
}
