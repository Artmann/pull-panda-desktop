/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/app/components/ui/tooltip'
import type { MergeOptions } from '@/app/lib/api'
import { createStore } from '@/app/store'
import type { Check } from '@/types/pull-request-details'

import { createMockPullRequest } from './__test-helpers__/pull-request-fixtures'
import {
  getAllowedMergeMethods,
  MergeDrawer,
  resolveInitialMergeMethod
} from './MergeDrawer'

const mockMergePullRequest = vi.fn()

vi.mock('@/app/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/api')>()),
  fetchCodeowners: () => Promise.resolve([]),
  fetchCollaborators: () => Promise.resolve([]),
  mergePullRequest: (...args: unknown[]) => mockMergePullRequest(...args)
}))

beforeEach(() => {
  localStorage.clear()
  mockMergePullRequest.mockReset()
  mockMergePullRequest.mockReturnValue(new Promise(() => undefined))
})

function createMockCheck(overrides: Partial<Check> = {}): Check {
  return {
    id: 'check-1',
    gitHubId: 'gh-check-1',
    pullRequestId: 'pr-1',
    name: 'CI Build',
    state: 'completed',
    conclusion: 'success',
    commitSha: 'abc123',
    suiteName: null,
    durationInSeconds: 120,
    detailsUrl: null,
    message: null,
    url: null,
    gitHubCreatedAt: '2024-01-01T00:00:00Z',
    gitHubUpdatedAt: '2024-01-01T00:00:00Z',
    syncedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

const mergeableOptions: MergeOptions = {
  allowMergeCommit: true,
  allowRebaseMerge: true,
  allowSquashMerge: true,
  mergeable: true,
  mergeableState: 'clean',
  requirements: []
}

const blockedOptions: MergeOptions = {
  ...mergeableOptions,
  mergeableState: 'blocked',
  requirements: [
    {
      description: 'Waiting for an approving review from a code owner.',
      key: 'approving-reviews',
      label: '1 approving review required',
      satisfied: false
    }
  ]
}

async function renderDrawer({
  checks = [],
  mergeOptions = mergeableOptions,
  open = true
}: {
  checks?: Check[]
  mergeOptions?: MergeOptions | null
  open?: boolean
} = {}) {
  const pullRequest = createMockPullRequest({ baseRefName: 'main' })
  const store = createStore({
    checks: { items: checks },
    mergeOptions: mergeOptions ? { 'pr-1': mergeOptions } : {},
    pullRequests: { initialized: true, items: [pullRequest] }
  } as never)

  await act(async () => {
    render(
      <Provider store={store}>
        <TooltipProvider>
          <MergeDrawer
            onClose={vi.fn()}
            open={open}
            pullRequest={pullRequest}
          />
        </TooltipProvider>
      </Provider>
    )
  })

  return store
}

describe('MergeDrawer', () => {
  it('renders nothing when closed', async () => {
    await renderDrawer({ open: false })

    expect(screen.queryByText('Merge')).not.toBeInTheDocument()
  })

  it('says the pull request is ready when nothing is in the way', async () => {
    await renderDrawer({ checks: [createMockCheck()] })

    expect(screen.getByText('Ready to merge')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Squash and merge' })
    ).toBeEnabled()
  })

  it('lists what stands between the pull request and a merge', async () => {
    await renderDrawer({
      checks: [createMockCheck({ conclusion: 'failure', name: 'Lint' })]
    })

    expect(
      screen.getAllByRole('heading').map((heading) => heading.textContent)
    ).toEqual(['Merge', 'Checks', 'Reviews', 'Conversations', 'Branch'])
    expect(screen.getByText('Lint is failing')).toBeInTheDocument()
    expect(screen.getByText('Needs changes')).toBeInTheDocument()
  })

  it('switches the merge button and hint with the method', async () => {
    await renderDrawer()

    await userEvent.click(screen.getByRole('radio', { name: 'Rebase' }))

    expect(
      screen.getByRole('button', { name: 'Rebase and merge' })
    ).toBeInTheDocument()
    expect(screen.getByText('Replays 0 commits on top of main.')).toBeDefined()
    expect(screen.queryByLabelText('Commit title')).not.toBeInTheDocument()
  })

  it('squashes with the prefilled commit message and deletes the branch', async () => {
    await renderDrawer()

    expect(screen.getByLabelText('Commit title')).toHaveValue('Test PR (#42)')

    await userEvent.click(
      screen.getByRole('button', { name: 'Squash and merge' })
    )

    expect(mockMergePullRequest).toHaveBeenCalledWith({
      commitMessage: 'Test PR body',
      commitTitle: 'Test PR (#42)',
      deleteBranch: true,
      mergeMethod: 'squash',
      owner: 'owner',
      pullNumber: 42,
      pullRequestId: 'pr-1',
      repo: 'repo'
    })
  })

  it('keeps the branch when "Delete branch after merge" is unticked', async () => {
    await renderDrawer()

    await userEvent.click(screen.getByLabelText('Delete branch after merge'))
    await userEvent.click(screen.getByRole('radio', { name: 'Merge' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Create a merge commit' })
    )

    expect(mockMergePullRequest).toHaveBeenCalledWith({
      deleteBranch: false,
      mergeMethod: 'merge',
      owner: 'owner',
      pullNumber: 42,
      pullRequestId: 'pr-1',
      repo: 'repo'
    })
  })

  it('disables the merge when blocked and asks before bypassing the rules', async () => {
    await renderDrawer({ mergeOptions: blockedOptions })

    expect(
      screen.getByRole('button', { name: 'Squash and merge' })
    ).toBeDisabled()
    expect(screen.getByText('Fix 1 item above to merge')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bypass rules…' }))

    expect(mockMergePullRequest).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Merge anyway' }))

    expect(mockMergePullRequest).toHaveBeenCalledTimes(1)
  })

  it('offers no bypass while the branch has conflicts', async () => {
    await renderDrawer({
      mergeOptions: {
        ...mergeableOptions,
        mergeable: false,
        mergeableState: 'dirty'
      }
    })

    expect(
      screen.queryByRole('button', { name: 'Bypass rules…' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Resolve merge conflicts')).toBeInTheDocument()
  })

  it('shows a loading state while merge options are fetched', async () => {
    await renderDrawer({ mergeOptions: null })

    expect(screen.getByText('Loading merge options...')).toBeInTheDocument()
  })
})

describe('getAllowedMergeMethods', () => {
  it('returns an empty list when merge options are missing', () => {
    expect(getAllowedMergeMethods(null)).toEqual([])
  })

  it('returns all methods in priority order when everything is allowed', () => {
    expect(getAllowedMergeMethods(mergeableOptions)).toEqual([
      'squash',
      'merge',
      'rebase'
    ])
  })

  it('returns only the allowed methods', () => {
    expect(
      getAllowedMergeMethods({
        ...mergeableOptions,
        allowSquashMerge: false
      })
    ).toEqual(['merge', 'rebase'])
  })
})

describe('resolveInitialMergeMethod', () => {
  it('returns null when merge options are missing', () => {
    expect(resolveInitialMergeMethod(null, 'squash')).toEqual(null)
  })

  it('returns null while mergeability is still unknown', () => {
    expect(
      resolveInitialMergeMethod(
        { ...mergeableOptions, mergeable: null },
        'squash'
      )
    ).toEqual(null)
  })

  it('prefers the saved method when it is allowed', () => {
    expect(resolveInitialMergeMethod(mergeableOptions, 'rebase')).toEqual(
      'rebase'
    )
  })

  it('falls back to the highest priority allowed method when the saved method is not allowed', () => {
    expect(
      resolveInitialMergeMethod(
        { ...mergeableOptions, allowRebaseMerge: false },
        'rebase'
      )
    ).toEqual('squash')
  })

  it('falls back through the priority order without a saved method', () => {
    expect(resolveInitialMergeMethod(mergeableOptions, null)).toEqual('squash')

    expect(
      resolveInitialMergeMethod(
        { ...mergeableOptions, allowSquashMerge: false },
        null
      )
    ).toEqual('merge')

    expect(
      resolveInitialMergeMethod(
        {
          ...mergeableOptions,
          allowMergeCommit: false,
          allowSquashMerge: false
        },
        null
      )
    ).toEqual('rebase')
  })

  it('returns null when no method is allowed', () => {
    expect(
      resolveInitialMergeMethod(
        {
          ...mergeableOptions,
          allowMergeCommit: false,
          allowRebaseMerge: false,
          allowSquashMerge: false
        },
        null
      )
    ).toEqual(null)
  })
})
