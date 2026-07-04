/**
 * @vitest-environment jsdom
 */
import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { beforeEach, describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/app/lib/store/themeContext'
import {
  setupLazyBrowserTestHarness,
  type LazyBrowserTestHarness
} from '@/app/lib/test-lazy-browser'
import commentsReducer from '@/app/store/comments-slice'

import { SimpleDiff } from './SimpleDiff'

const diffHunk = [
  '@@ -1,3 +1,4 @@',
  ' const value = 1',
  '+const added = 2',
  ' const other = 3'
].join('\n')

function createTestStore() {
  return configureStore({
    reducer: {
      comments: commentsReducer
    },
    preloadedState: {
      comments: { items: [] }
    }
  })
}

function renderSimpleDiff(filePath: string) {
  return render(
    <Provider store={createTestStore()}>
      <ThemeProvider>
        <SimpleDiff
          diffHunk={diffHunk}
          filePath={filePath}
        />
      </ThemeProvider>
    </Provider>
  )
}

describe('SimpleDiff syntax highlighting', () => {
  let lazyBrowser: LazyBrowserTestHarness

  beforeEach(() => {
    lazyBrowser = setupLazyBrowserTestHarness()
  })

  it('highlights diff lines using the language of the file', async () => {
    renderSimpleDiff('src/example.ts')

    lazyBrowser.triggerIntersecting()
    await lazyBrowser.flushIdleCallbacks()

    await waitFor(() => {
      expect(screen.getByTestId('diff-line-0').innerHTML).toContain(
        '<span style='
      )
    })
  })

  it('renders plain text for a file with an unknown extension', async () => {
    renderSimpleDiff('binary.exe')

    lazyBrowser.triggerIntersecting()
    await lazyBrowser.flushIdleCallbacks()

    const line = screen.getByTestId('diff-line-0')

    expect(line.textContent).toContain('const value = 1')
    expect(line.innerHTML).not.toContain('<span style=')
  })
})
