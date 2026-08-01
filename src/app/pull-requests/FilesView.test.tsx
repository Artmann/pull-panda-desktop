/**
 * @vitest-environment jsdom
 */
import { screen, fireEvent, act } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, beforeAll, vi } from 'vitest'

import type { ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import commentsReducer from '@/app/store/comments-slice'
import modifiedFilesReducer from '@/app/store/modified-files-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'

import {
  createMockModifiedFile,
  createMockPullRequest
} from './__test-helpers__/pull-request-fixtures'
import {
  installObserverStubs,
  renderWithProviders
} from './__test-helpers__/test-utils'
import { FilesView } from './FilesView'

beforeAll(() => {
  installObserverStubs()
})

function createFilesViewPullRequest(
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return createMockPullRequest({ isAuthor: true, ...overrides })
}

function createTestStore(
  options: {
    modifiedFiles?: ModifiedFile[]
  } = {}
) {
  return configureStore({
    reducer: {
      comments: commentsReducer,
      modifiedFiles: modifiedFilesReducer,
      pendingReviewComments: pendingReviewCommentsReducer
    },
    preloadedState: {
      comments: { items: [] },
      modifiedFiles: { items: options.modifiedFiles ?? [] },
      pendingReviewComments: {}
    }
  })
}

describe('FilesView', () => {
  it('renders empty state when no files', async () => {
    const pullRequest = createFilesViewPullRequest()
    const store = createTestStore({
      modifiedFiles: []
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('No files found.')).toBeInTheDocument()
  })

  it('renders files grouped by directory', async () => {
    const pullRequest = createFilesViewPullRequest()
    const files = [
      createMockModifiedFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      }),
      createMockModifiedFile({
        id: 'f2',
        filename: 'utils.ts',
        filePath: 'src/utils.ts'
      }),
      createMockModifiedFile({
        id: 'f3',
        filename: 'README.md',
        filePath: 'docs/README.md'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByText('docs')).toBeInTheDocument()
    expect(screen.getByText('src/index.ts')).toBeInTheDocument()
    expect(screen.getByText('src/utils.ts')).toBeInTheDocument()
    expect(screen.getByText('docs/README.md')).toBeInTheDocument()
  })

  it('collapses and expands folder sections', async () => {
    const pullRequest = createFilesViewPullRequest()
    const files = [
      createMockModifiedFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
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

  it('renders a diff for files with a diffHunk', async () => {
    const pullRequest = createFilesViewPullRequest()
    const files = [
      createMockModifiedFile({
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
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
    })

    // The diff itself is rendered by `@pierre/diffs` inside a shadow DOM via a
    // web worker, so its line contents are not queryable here. Assert instead
    // that the file card mounted a diff rather than the empty-state message.
    expect(screen.getByText('src/index.ts')).toBeInTheDocument()
    expect(screen.queryByText('No changes to display.')).not.toBeInTheDocument()
  })

  it('defers diff rendering after the initial eager files', async () => {
    const pullRequest = createFilesViewPullRequest()
    const files = Array.from({ length: 4 }, (_, index) =>
      createMockModifiedFile({
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
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('src/file-4.ts')).toBeInTheDocument()
    expect(screen.getByText('Diff rendering queued.')).toBeInTheDocument()
  })

  it('displays "No changes" message for files without diffHunk', async () => {
    const pullRequest = createFilesViewPullRequest()
    const files = [
      createMockModifiedFile({
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
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('No changes to display.')).toBeInTheDocument()
  })

  it('renders an image preview for image files instead of the diff', async () => {
    window.electron = {
      getApiPort: vi.fn().mockResolvedValue(54321)
    } as unknown as typeof window.electron

    const pullRequest = createFilesViewPullRequest({
      repositoryOwner: 'octocat',
      repositoryName: 'demo'
    })
    const files = [
      createMockModifiedFile({
        id: 'f1',
        filename: 'logo.png',
        filePath: 'assets/logo.png',
        status: 'added',
        diffHunk: null,
        blobSha: 'abc123'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
    })

    const image = await screen.findByAltText('assets/logo.png')

    expect(image.getAttribute('src')).toEqual(
      'http://localhost:54321/api/repos/octocat/demo/blobs/abc123?path=assets%2Flogo.png'
    )
    expect(screen.queryByText('No changes to display.')).not.toBeInTheDocument()
  })

  it('sorts dotfiles and dotfolders after regular files', async () => {
    const pullRequest = createFilesViewPullRequest()
    const files = [
      createMockModifiedFile({
        id: 'f1',
        filename: 'controlled-step-mode.md',
        filePath: '.changeset/controlled-step-mode.md'
      }),
      createMockModifiedFile({
        id: 'f2',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      }),
      createMockModifiedFile({
        id: 'f3',
        filename: '.env.example',
        filePath: '.env.example'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
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

    const pullRequest = createFilesViewPullRequest({
      repositoryOwner: 'testowner',
      repositoryName: 'testrepo'
    })
    const files = [
      createMockModifiedFile({
        id: 'f1',
        filename: 'index.ts',
        filePath: 'src/index.ts'
      })
    ]
    const store = createTestStore({
      modifiedFiles: files
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, store)
    })

    const button = screen.getByTitle('View file on GitHub')
    fireEvent.click(button)

    expect(openUrl).toHaveBeenCalledWith(
      'https://github.com/testowner/testrepo/blob/HEAD/src/index.ts'
    )
  })
})
