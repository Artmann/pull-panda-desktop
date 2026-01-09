/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, beforeAll } from 'vitest'

import type {
  ModifiedFile,
  PullRequestDetails
} from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import pullRequestDetailsReducer from '@/app/store/pull-request-details-slice'

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
    isDraft: false,
    isAuthor: true,
    isAssignee: false,
    isReviewer: false,
    labels: [],
    assignees: [],
    syncedAt: '2024-01-01T00:00:00Z',
    detailsSyncedAt: null,
    commentCount: 0,
    approvalCount: 0,
    changesRequestedCount: 0,
    ...overrides
  }
}

function createMockDetails(
  overrides: Partial<PullRequestDetails> = {}
): PullRequestDetails {
  return {
    checks: [],
    comments: [],
    commits: [],
    files: [],
    reactions: [],
    reviews: [],
    ...overrides
  }
}

function createTestStore(
  options: {
    pullRequestDetails?: Record<string, PullRequestDetails>
  } = {}
) {
  return configureStore({
    reducer: {
      pullRequestDetails: pullRequestDetailsReducer
    },
    preloadedState: {
      pullRequestDetails: options.pullRequestDetails ?? {}
    }
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(<Provider store={store}>{ui}</Provider>)
}

describe('FilesView', () => {
  it('renders empty state when no files', async () => {
    const pullRequest = createMockPullRequest()
    const store = createTestStore({
      pullRequestDetails: {
        [pullRequest.id]: createMockDetails({ files: [] })
      }
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
      pullRequestDetails: {
        [pullRequest.id]: createMockDetails({ files })
      }
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
      pullRequestDetails: {
        [pullRequest.id]: createMockDetails({ files })
      }
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
      pullRequestDetails: {
        [pullRequest.id]: createMockDetails({ files })
      }
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('context')).toBeInTheDocument()
    expect(screen.getByText('removed')).toBeInTheDocument()
    expect(screen.getByText('added')).toBeInTheDocument()
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
      pullRequestDetails: {
        [pullRequest.id]: createMockDetails({ files })
      }
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    expect(screen.getByText('No changes to display.')).toBeInTheDocument()
  })

  it('renders external link to view file on GitHub', async () => {
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
      pullRequestDetails: {
        [pullRequest.id]: createMockDetails({ files })
      }
    })

    await act(async () => {
      renderWithProviders(<FilesView pullRequest={pullRequest} />, { store })
    })

    const link = screen.getByTitle('View file on GitHub')

    expect(link).toHaveAttribute(
      'href',
      'https://github.com/testowner/testrepo/blob/HEAD/src/index.ts'
    )
    expect(link).toHaveAttribute('target', '_blank')
  })
})
