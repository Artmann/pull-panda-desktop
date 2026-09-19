import type { Element as HastElement, Root } from 'hast'
import isString from 'lodash/isString'
import { useTheme } from 'next-themes'
import type { ReactElement } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import rehypeReact, { type Options as RehypeReactOptions } from 'rehype-react'
import remarkGemoji from 'remark-gemoji'
import remarkGfm from 'remark-gfm'
import remarkParse, { type Options as RemarkParseOptions } from 'remark-parse'
import rehypeRaw from 'rehype-raw'
import remarkRehype, {
  type Options as RemarkRehypeOptions
} from 'remark-rehype'
import { type Plugin, unified } from 'unified'
import { visit } from 'unist-util-visit'

import { Link } from '@/app/components/Link'
import { scheduleIdleTask } from '@/app/lib/idle-scheduler'
import { useLazyRender } from '@/app/lib/lazy-render'

import {
  ensureLanguageLoaded,
  getLanguageFromPath,
  getSharedHighlighter
} from '@/app/lib/highlighter'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { cn } from '@/app/lib/utils'

// Render markdown links with our external-link component so clicks open in the
// user's browser instead of navigating inside the Electron window. Defined at
// module scope so the reference stays stable across renders (it feeds the
// memoised `createMarkdown` callback in `useRemark`).
const markdownComponents = { a: Link }

// Read the language off the `language-*` class rehype puts on the `code`
// element, falling back to plain text when the fence carried no language.
function languageFromClassList(codeElement: Element): string {
  const languageClass = Array.from(codeElement.classList).find((className) =>
    className.startsWith('language-')
  )

  return languageClass?.replace('language-', '') ?? 'text'
}

// Move Shiki's markup *into* the `pre` React rendered, rather than swapping
// that element out for Shiki's own. React owns this node: its fiber holds a
// direct reference to it, and unmounting the block — which happens on every
// navigation between pull requests, because a content change resets the parsed
// tree to null — makes React call `removeChild` with exactly this reference.
// Replacing the element leaves React holding a node that is no longer in the
// container, and the removal throws "The node to be removed is not a child of
// this node". Keeping the element identity stable keeps React's view of the DOM
// correct; only the contents, which React never revisits, are ours to change.
function adoptHighlightedMarkup(
  preElement: HTMLElement,
  highlighted: string
): void {
  const wrapper = document.createElement('div')

  wrapper.innerHTML = highlighted

  const highlightedPre = wrapper.firstElementChild

  if (!(highlightedPre instanceof HTMLElement)) {
    return
  }

  for (const attribute of Array.from(highlightedPre.attributes)) {
    if (attribute.name === 'class') {
      continue
    }

    preElement.setAttribute(attribute.name, attribute.value)
  }

  preElement.classList.add(...highlightedPre.classList)
  preElement.innerHTML = highlightedPre.innerHTML
}

// Highlight code blocks in the DOM when they come into view
async function highlightCodeBlocks(
  container: HTMLElement,
  lightTheme: string,
  darkTheme: string
): Promise<void> {
  const codeBlocks = container.querySelectorAll('pre > code')

  if (codeBlocks.length === 0) {
    return
  }

  const highlighter = await getSharedHighlighter()

  for (const codeElement of codeBlocks) {
    const preElement = codeElement.parentElement

    // `shiki` marks the blocks this pass has already rewritten.
    if (!preElement || preElement.classList.contains('shiki')) {
      continue
    }

    // Load the language grammar on demand, falling back to text when unknown
    const effectiveLanguage = await ensureLanguageLoaded(
      highlighter,
      languageFromClassList(codeElement)
    )

    adoptHighlightedMarkup(
      preElement,
      highlighter.codeToHtml(codeElement.textContent ?? '', {
        lang: effectiveLanguage,
        themes: {
          dark: darkTheme,
          light: lightTheme
        }
      })
    )
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
  const { ref: containerRef, shouldRender } = useLazyRender<HTMLDivElement>()
  const [result, createMarkdownContent, resetMarkdownContent] = useRemark({
    path,
    rehypeReactOptions: { components: markdownComponents }
  })
  const [isHighlighted, setIsHighlighted] = useState(false)
  const lastContentRef = useRef<string | null>(null)
  const { appTheme } = useAppTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const darkTheme = appTheme.darkShikiTheme
  const lightTheme = appTheme.lightShikiTheme
  const codeBackground = isDark
    ? appTheme.dark.background
    : appTheme.light.background

  // Reset the derived markdown and highlight state during render when the
  // `content` prop changes. Doing this inline (instead of in a useEffect) lets
  // React fold the reset into the same commit, so users never see a frame of
  // the previous content's stale highlight.
  if (lastContentRef.current !== content) {
    lastContentRef.current = content
    resetMarkdownContent()
    setIsHighlighted(false)
  }

  useEffect(() => {
    if (!shouldRender || result) {
      return
    }

    const scheduledTask = scheduleIdleTask(() => {
      createMarkdownContent(content)
    })

    return () => scheduledTask.cancel()
  }, [content, createMarkdownContent, result, shouldRender])

  useEffect(() => {
    if (!result || isHighlighted || !containerRef.current) {
      return
    }

    const container = containerRef.current
    const scheduledTask = scheduleIdleTask(() => {
      highlightCodeBlocks(container, lightTheme, darkTheme).then(() => {
        setIsHighlighted(true)
      })
    })

    return () => scheduledTask.cancel()
  }, [result, isHighlighted, lightTheme, darkTheme])

  return (
    <div
      ref={containerRef}
      className={cn(
        'markdown-block w-full max-w-none prose dark:prose-invert [&>:first-child]:mt-0 [&_p]:mb-2 [&_p:last-child]:mb-0',
        className
      )}
      style={{ '--code-bg': codeBackground } as React.CSSProperties}
    >
      {result ? (
        result
      ) : (
        <pre className="m-0 whitespace-pre-wrap break-words bg-transparent p-0 font-sans text-sm text-foreground">
          {content}
        </pre>
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
}: UseRemarkOptions = {}): [
  ReactElement | null,
  (source: string) => void,
  () => void
] {
  const [content, setContent] = useState<ReactElement | null>(null)
  const parseGenerationRef = useRef(0)

  const rehypeDetectLanguageFromPath: Plugin<[], Root> = useCallback(() => {
    return (tree: Root) => {
      visit(tree, 'element', (node: HastElement) => {
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
          node.properties.className = [node.properties.className, newClassName]
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
      const parseGeneration = parseGenerationRef.current + 1

      parseGenerationRef.current = parseGeneration

      void (async () => {
        try {
          const file = await unified()
            .use(remarkParse, remarkParseOptions)
            .use([remarkGemoji, remarkGfm])
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

          if (parseGenerationRef.current !== parseGeneration) {
            return
          }

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

  const resetMarkdown = useCallback(() => {
    parseGenerationRef.current += 1
    setContent(null)
  }, [])

  return [content, createMarkdown, resetMarkdown]
}
