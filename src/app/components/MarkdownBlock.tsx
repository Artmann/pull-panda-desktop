import { useTheme } from 'next-themes'
import type { CSSProperties, ReactElement } from 'react'
import { Fragment, memo, useLayoutEffect, useRef } from 'react'

import {
  ensureLanguageLoaded,
  getLoadedHighlighter,
  getSharedHighlighter,
  resolveLoadedLanguage
} from '@/app/lib/highlighter'
import { scheduleIdleTask } from '@/app/lib/idle-scheduler'
import { renderMarkdown } from '@/app/lib/markdown-cache'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { cn } from '@/app/lib/utils'

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
// navigation between pull requests, because the parsed tree is keyed — makes
// React call `removeChild` with exactly this reference. Replacing the element
// leaves React holding a node that is no longer in the container, and the
// removal throws "The node to be removed is not a child of this node". Keeping
// the element identity stable keeps React's view of the DOM correct; only the
// contents, which React never revisits, are ours to change.
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

// Highlight every block whose grammar is already in memory, without awaiting
// anything, so a warm highlighter finishes before the browser paints. Returns
// whether it handled all of them; `false` means some still need the async pass.
function highlightLoadedCodeBlocks(
  container: HTMLElement,
  lightTheme: string,
  darkTheme: string
): boolean {
  const codeBlocks = container.querySelectorAll('pre > code')

  if (codeBlocks.length === 0) {
    return true
  }

  const highlighter = getLoadedHighlighter()

  if (!highlighter) {
    return false
  }

  let handledEveryBlock = true

  for (const codeElement of codeBlocks) {
    const preElement = codeElement.parentElement

    // `shiki` marks the blocks this pass has already rewritten.
    if (!preElement || preElement.classList.contains('shiki')) {
      continue
    }

    const language = resolveLoadedLanguage(
      highlighter,
      languageFromClassList(codeElement)
    )

    if (!language) {
      handledEveryBlock = false

      continue
    }

    adoptHighlightedMarkup(
      preElement,
      highlighter.codeToHtml(codeElement.textContent ?? '', {
        lang: language,
        themes: {
          dark: darkTheme,
          light: lightTheme
        }
      })
    )
  }

  return handledEveryBlock
}

// Highlight code blocks in the DOM, loading the highlighter and any missing
// grammars first. Only reached the first time a given language shows up.
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
  const containerRef = useRef<HTMLDivElement>(null)
  const { appTheme } = useAppTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const darkTheme = appTheme.darkShikiTheme
  const lightTheme = appTheme.lightShikiTheme
  const codeBackground = isDark
    ? appTheme.dark.background
    : appTheme.light.background

  // Parsed during render and memoised across mounts, so the markdown is correct
  // in the very first frame instead of arriving an idle callback later.
  const rendering = renderMarkdown({ content, path })

  // Shiki writes its markup straight into the DOM, so there is no declarative
  // way to express this one. A layout effect gets it done before the browser
  // paints whenever the grammar is already loaded.
  useLayoutEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    if (highlightLoadedCodeBlocks(container, lightTheme, darkTheme)) {
      return
    }

    const scheduledTask = scheduleIdleTask(() => {
      highlightCodeBlocks(container, lightTheme, darkTheme).catch((error) => {
        console.error('Highlighting error:', error)
      })
    })

    return () => scheduledTask.cancel()
  }, [darkTheme, lightTheme, rendering.id])

  return (
    <div
      ref={containerRef}
      className={cn(
        'markdown-block w-full max-w-none prose dark:prose-invert [&>:first-child]:mt-0 [&_p]:mb-2 [&_p:last-child]:mb-0',
        className
      )}
      style={{ '--code-bg': codeBackground } as CSSProperties}
    >
      {rendering.element ? (
        // Keyed so a new body unmounts the old tree instead of being diffed
        // into it. React would otherwise reuse a `pre` that highlighting has
        // already rewritten, leaving its child fibers pointing at detached
        // nodes — which shows the previous pull request's code, or throws on
        // removal. A wrapper element would break the `prose` and
        // `[&>:first-child]` rules, so this has to be a fragment.
        <Fragment key={rendering.id}>{rendering.element}</Fragment>
      ) : (
        <pre className="m-0 whitespace-pre-wrap break-words bg-transparent p-0 font-sans text-sm text-foreground">
          {content}
        </pre>
      )}
    </div>
  )
})
