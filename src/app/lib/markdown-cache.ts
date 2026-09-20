import type { Element as HastElement, Root } from 'hast'
import isString from 'lodash/isString'
import type { ReactElement } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import rehypeRaw from 'rehype-raw'
import rehypeReact, { type Options as RehypeReactOptions } from 'rehype-react'
import remarkGemoji from 'remark-gemoji'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { type Plugin, unified } from 'unified'
import { visit } from 'unist-util-visit'

import { Link } from '@/app/components/Link'
import { getLanguageFromPath } from '@/app/lib/highlighter'
import { startSpan } from '@/app/lib/telemetry/tracer'

// Parsed markdown, memoised across mounts.
//
// Every plugin below is synchronous, so a body can be turned into React
// elements during render rather than behind an idle callback. That is what
// keeps the raw source from flashing when the reader moves between pull
// requests. The cache then makes the second visit free, which matters because
// the timeline is virtualised and comments remount constantly while scrolling.

export interface MarkdownRendering {
  // `null` when parsing threw. Callers fall back to showing the source.
  element: ReactElement | null
  // Changes whenever this is a freshly parsed tree. `MarkdownBlock` uses it as
  // a React key so a new body remounts instead of being diffed into the old
  // one, which Shiki's in-place DOM rewriting cannot survive.
  id: number
}

export const markdownCacheLimit = 200

// Render markdown links with our external-link component so clicks open in the
// user's browser instead of navigating inside the Electron window.
const markdownComponents = { a: Link }

// Anything that changes the output has to be part of the cache key. Today that
// is the source and the path, which decides the language for a fence that
// carries none. `markdownComponents` is module scope and `Link` is stateless,
// so neither varies per call site — but if an override ever captures pull
// request state, it has to go into the key too or this will serve the wrong
// tree.
const renderings = new Map<string, MarkdownRendering>()

let nextRenderingId = 1

export function renderMarkdown({
  content,
  path
}: {
  content: string
  path?: string
}): MarkdownRendering {
  const key = `${path ?? ''}\u0000${content}`
  const cached = renderings.get(key)

  if (cached) {
    // Re-insert to move this entry to the young end of the map.
    renderings.delete(key)
    renderings.set(key, cached)

    return cached
  }

  const rendering: MarkdownRendering = {
    element: parseMarkdown(content, path),
    id: nextRenderingId
  }

  nextRenderingId += 1
  renderings.set(key, rendering)

  while (renderings.size > markdownCacheLimit) {
    const oldestKey = renderings.keys().next().value

    if (oldestKey === undefined) {
      break
    }

    renderings.delete(oldestKey)
  }

  return rendering
}

export function clearMarkdownCache(): void {
  renderings.clear()
}

// Runs during render, so it must never throw: `rehype-raw` parses embedded HTML
// with parse5, which can reject malformed markup, and an exception here would
// take down the whole page through the error boundary rather than one comment.
function parseMarkdown(content: string, path?: string): ReactElement | null {
  const span = startSpan('markdown.parse', {
    attributes: { length: content.length }
  })

  try {
    const file = unified()
      .use(remarkParse)
      .use([remarkGemoji, remarkGfm])
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeDetectLanguageFromPath(path))
      .use(rehypeReact, {
        Fragment: jsxRuntime.Fragment,
        components: markdownComponents,
        jsx: jsxRuntime.jsx,
        jsxs: jsxRuntime.jsxs
      } satisfies RehypeReactOptions)
      .processSync(content)

    return file.result as ReactElement
  } catch (error) {
    span.setStatus('error', (error as Error).message)
    console.error('Markdown error:', error)

    return null
  } finally {
    span.end()
  }
}

// Fences in a review comment carry no language of their own — a suggestion
// block is just ```suggestion — so take one from the file being reviewed.
function rehypeDetectLanguageFromPath(path?: string): Plugin<[], Root> {
  return () => {
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
          const suggestionClassIndex =
            node.properties.className.indexOf('language-suggestion')

          if (suggestionClassIndex !== -1) {
            node.properties.className[suggestionClassIndex] = newClassName
          } else {
            node.properties.className.push(newClassName)
          }
        }
      })
    }
  }
}
