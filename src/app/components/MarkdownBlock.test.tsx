/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/app/lib/store/themeContext'
import {
  setupLazyBrowserTestHarness,
  type LazyBrowserTestHarness
} from '@/app/lib/test-lazy-browser'

// Stand in for Shiki so the highlighting pass runs synchronously and produces
// markup this test can assert on, without loading real grammars and themes.
vi.mock('@/app/lib/highlighter', () => ({
  ensureLanguageLoaded: () => Promise.resolve('typescript'),
  getLanguageFromPath: (): string | undefined => undefined,
  getSharedHighlighter: () =>
    Promise.resolve({
      codeToHtml: (code: string) =>
        `<pre class="shiki" tabindex="0"><code><span class="line">${code}</span></code></pre>`
    })
}))

import { MarkdownBlock } from './MarkdownBlock'

let lazyBrowser: LazyBrowserTestHarness

function renderMarkdownBlock(content: string) {
  return render(
    <ThemeProvider>
      <MarkdownBlock content={content} />
    </ThemeProvider>
  )
}

const descriptionWithCode =
  'Run this first:\n\n```ts\nconst answer = 42\n```\n'

describe('MarkdownBlock', () => {
  beforeEach(() => {
    lazyBrowser = setupLazyBrowserTestHarness()
  })

  it('keeps markdown searchable before parsing it lazily', async () => {
    renderMarkdownBlock('# Review note\n\nPlease check the cache path.')

    expect(screen.getByText(/# Review note/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Review note' })).toEqual(null)

    lazyBrowser.triggerIntersecting()
    await lazyBrowser.flushIdleCallbacks()

    expect(
      await screen.findByRole('heading', { name: 'Review note' })
    ).toBeInTheDocument()
  })

  it('highlights a code block without detaching the node React owns', async () => {
    const { rerender } = renderMarkdownBlock(descriptionWithCode)

    lazyBrowser.triggerIntersecting()
    await lazyBrowser.flushIdleCallbacks()
    await lazyBrowser.flushIdleCallbacks()

    expect(document.querySelectorAll('pre.shiki')).toHaveLength(1)

    // Moving to another pull request swaps `content` on the same mounted
    // block, so React unmounts the highlighted tree. It can only do that when
    // highlighting left its `pre` in place; replacing the element used to
    // throw "The node to be removed is not a child of this node" here.
    rerender(
      <ThemeProvider>
        <MarkdownBlock content="A plain description." />
      </ThemeProvider>
    )

    await lazyBrowser.flushIdleCallbacks()

    expect(
      await screen.findByText('A plain description.')
    ).toBeInTheDocument()
    expect(document.querySelectorAll('pre.shiki')).toHaveLength(0)
  })
})
