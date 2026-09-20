/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/app/lib/store/themeContext'
import {
  setupLazyBrowserTestHarness,
  type LazyBrowserTestHarness
} from '@/app/lib/test-lazy-browser'

// Stand in for Shiki so the highlighting pass produces markup this test can
// assert on, without loading real grammars and themes. `loaded` decides whether
// the block finds a warm highlighter and highlights before paint, or has to
// fall back to the asynchronous idle pass.
const highlighterMock = vi.hoisted(() => {
  const highlighter = {
    codeToHtml: (code: string) =>
      `<pre class="shiki" tabindex="0"><code><span class="line">${code}</span></code></pre>`
  }

  return { highlighter, state: { loaded: null as typeof highlighter | null } }
})

vi.mock('@/app/lib/highlighter', () => ({
  ensureLanguageLoaded: () => Promise.resolve('typescript'),
  getLanguageFromPath: (): string | undefined => undefined,
  getLoadedHighlighter: () => highlighterMock.state.loaded,
  getSharedHighlighter: () => Promise.resolve(highlighterMock.highlighter),
  resolveLoadedLanguage: () => 'typescript',
  warmHighlighter: (): void => undefined
}))

const cacheMock = vi.hoisted(() => ({ state: { failing: false } }))

vi.mock('@/app/lib/markdown-cache', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/markdown-cache')>()

  return {
    ...actual,
    renderMarkdown: (options: { content: string; path?: string }) =>
      cacheMock.state.failing
        ? { element: null, id: 1 }
        : actual.renderMarkdown(options)
  }
})

import { clearMarkdownCache } from '@/app/lib/markdown-cache'

import { MarkdownBlock } from './MarkdownBlock'

let lazyBrowser: LazyBrowserTestHarness

function markdownBlock(content: string): ReactElement {
  return (
    <ThemeProvider>
      <MarkdownBlock content={content} />
    </ThemeProvider>
  )
}

function renderMarkdownBlock(content: string) {
  return render(markdownBlock(content))
}

const descriptionWithCode = 'Run this first:\n\n```ts\nconst answer = 42\n```\n'

describe('MarkdownBlock', () => {
  beforeEach(() => {
    cacheMock.state.failing = false
    highlighterMock.state.loaded = null
    clearMarkdownCache()
    lazyBrowser = setupLazyBrowserTestHarness()
  })

  it('renders markdown on the first paint', () => {
    renderMarkdownBlock('# Review note\n\nPlease check the cache path.')

    // Deliberately synchronous: no idle flush, no `findBy`. A reader switching
    // pull requests must never see a frame of the unparsed source.
    expect(
      screen.getByRole('heading', { name: 'Review note' })
    ).toBeInTheDocument()
    expect(screen.queryByText(/# Review note/)).toEqual(null)
  })

  it('renders the next pull request without flashing its source', () => {
    const { rerender } = renderMarkdownBlock('# First note')

    // `PullRequestPage` never remounts on a switch, so this is the path the
    // app actually takes: the same mounted block gets new content.
    rerender(markdownBlock('## Second note'))

    expect(
      screen.getByRole('heading', { name: 'Second note' })
    ).toBeInTheDocument()
    expect(screen.queryByText(/## Second note/)).toEqual(null)
  })

  it('reuses the cached tree when returning to a pull request', () => {
    const { rerender } = renderMarkdownBlock('# First note')

    rerender(markdownBlock('# Second note'))
    rerender(markdownBlock('# First note'))

    expect(
      screen.getByRole('heading', { name: 'First note' })
    ).toBeInTheDocument()
  })

  it('highlights before paint when the grammar is already loaded', () => {
    highlighterMock.state.loaded = highlighterMock.highlighter

    renderMarkdownBlock(descriptionWithCode)

    expect(document.querySelectorAll('pre.shiki')).toHaveLength(1)
  })

  it('highlights a code block without detaching the node React owns', async () => {
    const { rerender } = renderMarkdownBlock(descriptionWithCode)

    await lazyBrowser.flushIdleCallbacks()

    expect(document.querySelectorAll('pre.shiki')).toHaveLength(1)

    // Moving to another pull request swaps `content` on the same mounted
    // block, so React unmounts the highlighted tree. It can only do that when
    // highlighting left its `pre` in place; replacing the element used to
    // throw "The node to be removed is not a child of this node" here.
    rerender(markdownBlock('A plain description.'))

    expect(screen.getByText('A plain description.')).toBeInTheDocument()
    expect(document.querySelectorAll('pre.shiki')).toHaveLength(0)
  })

  it('swaps a highlighted code block for different code', async () => {
    highlighterMock.state.loaded = highlighterMock.highlighter

    const { rerender } = renderMarkdownBlock(
      'Before:\n\n```ts\nconst first = 1\n```\n'
    )

    expect(screen.getByText('const first = 1')).toBeInTheDocument()

    // Both bodies put a fenced block in the same position, so without a key on
    // the parsed tree React reuses the `pre` that highlighting already rewrote
    // and the reader keeps seeing the previous pull request's code.
    rerender(markdownBlock('Before:\n\n```ts\nconst second = 2\n```\n'))

    expect(screen.getByText('const second = 2')).toBeInTheDocument()
    expect(screen.queryByText('const first = 1')).toEqual(null)
  })

  it('falls back to the raw source when parsing fails', () => {
    cacheMock.state.failing = true

    renderMarkdownBlock('# Broken note')

    expect(screen.getByText('# Broken note')).toBeInTheDocument()
  })
})
