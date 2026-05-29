/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, beforeAll, vi } from 'vitest'

import type { ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { ThemeProvider } from '@/app/lib/store/themeContext'
import commentsReducer from '@/app/store/comments-slice'
import modifiedFilesReducer from '@/app/store/modified-files-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import settingsReducer from '@/app/store/settings-slice'

import { FilesView } from './FilesView'

beforeAll(() => {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {
      // Mock
    }
    disconnect() {
      // Mock
    }
    observe() {
      // Mock
    }
    unobserve() {
      // Mock
    }
  } as unknown as typeof IntersectionObserver

  global.ResizeObserver = class ResizeObserver {
    constructor() {
      // Mock
    }
    disconnect() {
      // Mock
    }
    observe() {
      // Mock
    }
    unobserve() {
      // Mock
    }
  } as unknown as typeof ResizeObserver
})

function createMockFile(overrides: Partial<ModifiedFile> = {}): ModifiedFile {
  return {
    id: 'file-1',
    pullRequestId: 'pr-1',
    filename: 'index.ts',
    filePath: 'src/index.ts',
    status: 'modified',
    additions: 10,
    deletions: 5,
    changes: 15,
    diffHunk: '@@ -1,5 +1,5 @@\n context\n-old line\n+new line',
    syncedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

function createMockPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    id: 'pr-1',
    number: 42,
    title: 'Test PR',
    state: 'OPEN',
    url: 'https://github.com/owner/repo/pull/42',
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    authorLogin: 'testuser',
    authorAvatarUrl: 'https://example.com/avatar.png',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    body: 'Test PR body',
    bodyHtml: null,
    headRefName: null,
    isDraft: false,
    isAuthor: true,
    isAssignee: false,
    isReviewer: false,
    labels: [],
    assignees: [],
    requestedReviewers: [],
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: null,
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}

function createTestStore(
  options: {
    combineTestFiles?: boolean
    modifiedFiles?: ModifiedFile[]
  } = {}
) {
  return configureStore({
    reducer: {
      comments: commentsReducer,
      modifiedFiles: modifiedFilesReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      settings: settingsReducer
    },
    preloadedState: {
      comments: { items: [] },
      modifiedFiles: { items: options.modifiedFiles ?? [] },
      pendingReviewComments: {},
      settings: { combineTestFiles: options.combineTestFiles ?? true }
    }
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(
    <Provider store={store}>
      <ThemeProvider>{ui}</ThemeProvider>
    </Provider>
  )
}

describe('FilesView', () => {
  it('renders empty state when no files', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      modifiedFiles: []
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('No files found.')).toBeInTheDocument()
  })

  it('renders files grouped by directory', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      }),
      createMockFile({
        id: 'f2',
        filename: 'utils.ts',
        filePath: 'src/utils.ts'
      }),
      createMockFile({
        id: 'f3',
        filename: 'README.md',
        filePath: 'docs/README.md'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByText('docs')).toBeInTheDocument()
    expect(screen.getByText('src/index.ts')).toBeInTheDocument()
    expect(screen.getByText('src/utils.ts')).toBeInTheDocument()
    expect(screen.getByText('docs/README.md')).toBeInTheDocument()
  })

  it('collapses and expands folder sections', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('src/index.ts')).toBeInTheDocument()

    const folderButton = screen.getByRole('button', { name: /src/i })

    await act(async () => {
      fireEvent.click(folderButton)
    })

    expect(screen.queryByText('src/index.ts')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(folderButton)
    })

    expect(screen.getByText('src/index.ts')).toBeInTheDocument()
  })

  it('displays diff content for files with diffHunk', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts',
        diffHunk: '@@ -1,3 +1,3 @@\n context\n-removed\n+added'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('context')).toBeInTheDocument()
    expect(screen.getByText('removed')).toBeInTheDocument()
    expect(screen.getByText('added')).toBeInTheDocument()
  })

  it('defers diff rendering after the initial eager files', async () => {
    const pullRequest = createMockPullRequest()
    const files = Array.from({ length: 4 }, (_, index) =>
      createMockFile({
        id: `f${index + 1}`,
        filename: `file-${index + 1}.ts`,
        filePath: `src/file-${index + 1}.ts`,
        diffHunk: `@@ -1,3 +1,3 @@\n context\n-old-${index + 1}\n+new-${index + 1}`
      })
    )
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('src/file-4.ts')).toBeInTheDocument()
    expect(screen.getByText('Diff rendering queued.')).toBeInTheDocument()
  })

  it('displays "No changes" message for files without diffHunk', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts',
        diffHunk: null
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('No changes to display.')).toBeInTheDocument()
  })

  it('sorts dotfiles and dotfolders after regular files', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'controlled-step-mode.md',
        filePath: '.changeset/controlled-step-mode.md'
      }),
      createMockFile({
        id: 'f2',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      }),
      createMockFile({
        id: 'f3',
        filename: '.env.example',
        filePath: '.env.example'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    const sections = screen.getAllByRole('button')
    const sectionLabels = sections.map((button) => button.textContent)

    const srcIndex = sectionLabels.findIndex((label) => label?.includes('src'))
    const changesetIndex = sectionLabels.findIndex((label) =>
      label?.includes('.changeset')
    )

    expect(srcIndex).toBeLessThan(changesetIndex)
  })

  it('opens file on GitHub when clicking the external link button', async () => {
    const openUrl = vi.fn()
    window.electron = { openUrl } as unknown as typeof window.electron

    const pullRequest = createMockPullRequest({
      repositoryOwner: 'testowner',
      repositoryName: 'testrepo'
    })
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    const button = screen.getByTitle('View file on GitHub')
    fireEvent.click(button)

    expect(openUrl).toHaveBeenCalledWith(
      'https://github.com/testowner/testrepo/blob/HEAD/src/index.ts'
    )
  })

  it('folds a paired test into its implementation in combine mode', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'customers.ts',
        filePath: 'src/customers.ts'
      }),
      createMockFile({
        id: 'f2',
        filename: 'customers.test.ts',
        filePath: 'src/customers.test.ts'
      })
    ]
    const store = createTestStore({ modifiedFiles: files })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('src/customers.ts')).toBeInTheDocument()
    expect(screen.queryByText('src/customers.test.ts')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Implementation' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test' })).toBeInTheDocument()
  })

  it('switches to the test diff when toggling a paired file', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'customers.ts',
        filePath: 'src/customers.ts',
        diffHunk: '@@ -1,2 +1,2 @@\n shared\n+implementationline'
      }),
      createMockFile({
        id: 'f2',
        filename: 'customers.test.ts',
        filePath: 'src/customers.test.ts',
        diffHunk: '@@ -1,2 +1,2 @@\n shared\n+testfileline'
      })
    ]
    const store = createTestStore({ modifiedFiles: files })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('implementationline')).toBeInTheDocument()
    expect(screen.queryByText('testfileline')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    })

    expect(screen.getByText('src/customers.test.ts')).toBeInTheDocument()
    expect(screen.getByText('testfileline')).toBeInTheDocument()
  })

  it('flags a source file with no test in combine mode', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'customers.ts',
        filePath: 'src/customers.ts'
      })
    ]
    const store = createTestStore({ modifiedFiles: files })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('Missing test')).toBeInTheDocument()
  })

  it('shows tests as separate cards when combine mode is off', async () => {
    const pullRequest = createMockPullRequest()
    const files = [
      createMockFile({
        id: 'f1',
        filename: 'customers.ts',
        filePath: 'src/customers.ts'
      }),
      createMockFile({
        id: 'f2',
        filename: 'customers.test.ts',
        filePath: 'src/customers.test.ts'
      })
    ]
    const store = createTestStore({
      combineTestFiles: false,
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('src/customers.ts')).toBeInTheDocument()
    expect(screen.getByText('src/customers.test.ts')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Implementation' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Missing test')).not.toBeInTheDocument()
  })
})
