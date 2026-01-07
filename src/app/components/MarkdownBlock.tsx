import rehypeShiki from '@shikijs/rehype'
import type { Element, Root } from 'hast'
import isString from 'lodash/isString'
import type { ReactElement } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import rehypeReact, { type Options as RehypeReactOptions } from 'rehype-react'
import remarkGfm from 'remark-gfm'
import remarkParse, { type Options as RemarkParseOptions } from 'remark-parse'
import remarkRehype, {
  type Options as RemarkRehypeOptions
} from 'remark-rehype'
import { type Plugin, unified } from 'unified'
import { visit } from 'unist-util-visit'

import { Skeleton } from './ui/skeleton'

import { cn } from '@/app/lib/utils'

export const MarkdownBlock = memo(function MarkdownBlock({
  className,
  content,
  path
}: {
  className?: string
  content: string
  path?: string
}): ReactElement {
  const [result, createMarkdownContent] = useRemark({ path })

  useEffect(() => {
    createMarkdownContent(content)
  }, [content, createMarkdownContent])

  return (
    <div
      className={cn(
        'markdown-block w-full max-w-none prose prose-sm dark:prose-invert',
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

function useRemark({
  path,
  rehypeReactOptions,
  remarkParseOptions,
  remarkRehypeOptions,
  onError = (error) => console.error('Markdown error:', error)
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

        const suggestedLanguage = suggestedLanguageFromPath(path)

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

  const createMarkdown = useCallback(
    (source: string) => {
      void (async () => {
        try {
          // TypeScript has difficulty inferring the correct types through the unified
          // plugin chain due to complex generic transformations. The types are safe
          // at runtime as each plugin validates its input/output types.
          const file = await unified()
            .use(remarkParse, remarkParseOptions)
            .use([remarkGfm])
            .use(remarkRehype, remarkRehypeOptions)
            .use(rehypeDetectLanguageFromPath)
            .use(rehypeShiki, {
              themes: {
                light: 'vitesse-light',
                dark: 'vitesse-dark'
              }
            })
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

function suggestedLanguageFromPath(path?: string): string | undefined {
  if (!path) {
    return undefined
  }

  const extension = path.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'py':
      return 'python'
    case 'java':
      return 'java'
    case 'c':
    case 'cpp':
      return 'c'
    case 'go':
      return 'go'
    case 'rb':
      return 'ruby'
    case 'php':
      return 'php'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
      return 'css'
    default:
      return undefined
  }
}
