/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearMarkdownCache,
  markdownCacheLimit,
  renderMarkdown
} from './markdown-cache'

const suggestion = '```suggestion\nconst answer = 42\n```\n'

function renderToContainer(element: ReactElement | null): HTMLElement {
  if (!element) {
    throw new Error('Expected markdown to parse into an element.')
  }

  return render(element).container
}

describe('renderMarkdown', () => {
  beforeEach(() => {
    clearMarkdownCache()
  })

  it('parses markdown into react elements', () => {
    const container = renderToContainer(
      renderMarkdown({ content: '# Title' }).element
    )

    expect(container.querySelector('h1')?.textContent).toEqual('Title')
  })

  it('returns the very same rendering for repeated content', () => {
    const first = renderMarkdown({ content: '# Title' })
    const second = renderMarkdown({ content: '# Title' })

    // Identity is the assertion: a shared element lets React bail out of
    // re-rendering the subtree, and it proves we did not parse twice.
    expect(second).toBe(first)
  })

  it('keeps separate entries for the same content at different paths', () => {
    const typescript = renderMarkdown({ content: suggestion, path: 'a.ts' })
    const unknown = renderMarkdown({ content: suggestion })

    expect(typescript.id).not.toEqual(unknown.id)
    expect(
      renderToContainer(typescript.element).querySelector('code')?.className
    ).toEqual('language-typescript')
  })

  it('leaves a fence alone when no path suggests a language', () => {
    const container = renderToContainer(
      renderMarkdown({ content: suggestion }).element
    )

    expect(container.querySelector('code')?.className).toEqual(
      'language-suggestion'
    )
  })

  it('evicts the least recently used entry once the cache is full', () => {
    const oldest = renderMarkdown({ content: '# Entry 0' })
    const newest = renderMarkdown({ content: `# Entry ${markdownCacheLimit}` })

    for (let index = 1; index < markdownCacheLimit; index += 1) {
      renderMarkdown({ content: `# Entry ${index}` })
    }

    // The loop filled the window, so `# Entry 0` was pushed out while the entry
    // added just before it survived. Check the survivor first: looking up the
    // evicted one re-inserts it and would evict something else in turn.
    expect(
      renderMarkdown({ content: `# Entry ${markdownCacheLimit}` }).id
    ).toEqual(newest.id)
    expect(renderMarkdown({ content: '# Entry 0' }).id).not.toEqual(oldest.id)
  })
})
