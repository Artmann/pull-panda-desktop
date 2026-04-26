/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/app/lib/store/themeContext'
import {
  setupLazyBrowserTestHarness,
  type LazyBrowserTestHarness
} from '@/app/lib/test-lazy-browser'

import { MarkdownBlock } from './MarkdownBlock'

let lazyBrowser: LazyBrowserTestHarness

function renderMarkdownBlock(content: string) {
  return render(
    <ThemeProvider>
      <MarkdownBlock content={content} />
    </ThemeProvider>
  )
}

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
})
