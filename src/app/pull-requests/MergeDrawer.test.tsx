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

import { noMergeAutomation } from './__test-helpers__/merge-options-fixtures'
import { createMockPullRequest } from './__test-helpers__/pull-request-fixtures'
import {
  getAllowedMergeMethods,
  getMergeAction,
  MergeDrawer,
  resolveInitialMergeMethod
} from './MergeDrawer'

const mockDequeuePullRequest = vi.fn()
const mockDisableAutoMerge = vi.fn()
const mockEnableAutoMerge = vi.fn()
const mockEnqueuePullRequest = vi.fn()
const mockMergePullRequest = vi.fn()

vi.mock('@/app/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/api')>()),
  dequeuePullRequest: (...args: unknown[]) => mockDequeuePullRequest(...args),
  disableAutoMerge: (...args: unknown[]) => mockDisableAutoMerge(...args),
  enableAutoMerge: (...args: unknown[]) => mockEnableAutoMerge(...args),
  enqueuePullRequest: (...args: unknown[]) => mockEnqueuePullRequest(...args),
  fetchCodeowners: () => Promise.resolve([]),
  fetchCollaborators: () => Promise.resolve([]),
  mergePullRequest: (...args: unknown[]) => mockMergePullRequest(...args)
}))

beforeEach(() => {
  localStorage.clear()

  for (const mock of [
    mockDequeuePullRequest,
    mockDisableAutoMerge,
    mockEnableAutoMerge,
    mockEnqueuePullRequest,
    mockMergePullRequest
  ]) {
    mock.mockReset()
    mock.mockReturnValue(new Promise(() => undefined))
  }
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
  ...noMergeAutomation,
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

describe('MergeDrawer auto-merge and merge queue', () => {
  const autoMergeOptions: MergeOptions = {
    ...blockedOptions,
    viewerCanEnableAutoMerge: true
  }

  const queueOptions: MergeOptions = {
    ...mergeableOptions,
    isMergeQueueEnabled: true,
    mergeQueueMethod: 'squash'
  }

  it('enables auto-merge with the chosen method and commit message', async () => {
    const enabledOptions: MergeOptions = {
      ...autoMergeOptions,
      autoMergeRequest: {
        enabledAt: '2026-10-14T10:00:00Z',
        enabledByLogin: 'octocat',
        mergeMethod: 'squash'
      },
      viewerCanDisableAutoMerge: true,
      viewerCanEnableAutoMerge: false
    }

    mockEnableAutoMerge.mockResolvedValue(enabledOptions)

    const store = await renderDrawer({ mergeOptions: autoMergeOptions })

    await userEvent.click(
      screen.getByRole('button', { name: 'Enable auto-merge' })
    )

    expect(mockEnableAutoMerge).toHaveBeenCalledWith({
      commitBody: 'Test PR body',
      commitHeadline: 'Test PR (#42)',
      mergeMethod: 'squash',
      pullRequestId: 'pr-1'
    })
    expect(store.getState().mergeOptions['pr-1']).toEqual(enabledOptions)
    expect(
      screen.getByRole('button', { name: 'Disable auto-merge' })
    ).toBeInTheDocument()
  })

  it('disables auto-merge', async () => {
    mockDisableAutoMerge.mockResolvedValue(autoMergeOptions)

    const store = await renderDrawer({
      mergeOptions: {
        ...autoMergeOptions,
        autoMergeRequest: {
          enabledAt: '2026-10-14T10:00:00Z',
          enabledByLogin: 'octocat',
          mergeMethod: 'merge'
        },
        viewerCanDisableAutoMerge: true,
        viewerCanEnableAutoMerge: false
      }
    })

    expect(
      screen.getByText(
        'It will be merged with a merge commit once all requirements are met. Enabled by octocat.'
      )
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Disable auto-merge' })
    )

    expect(mockDisableAutoMerge).toHaveBeenCalledWith('pr-1')
    expect(store.getState().mergeOptions['pr-1']).toEqual(autoMergeOptions)
  })

  it('adds a ready pull request to the merge queue instead of merging it', async () => {
    const store = await renderDrawer({ mergeOptions: queueOptions })

    expect(
      screen.queryByRole('radio', { name: 'Squash' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('The queue merges with squash')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Add to merge queue' })
    )

    expect(mockEnqueuePullRequest).toHaveBeenCalledWith('pr-1')
    expect(mockMergePullRequest).not.toHaveBeenCalled()
    expect(store.getState().mergeOptions['pr-1']?.mergeQueueEntry).toEqual({
      enqueuedAt: expect.any(String),
      estimatedTimeToMerge: null,
      position: null,
      state: 'QUEUED'
    })
  })

  it('rolls back when adding to the merge queue fails', async () => {
    mockEnqueuePullRequest.mockRejectedValue(new Error('Queue is closed'))

    const store = await renderDrawer({ mergeOptions: queueOptions })

    await userEvent.click(
      screen.getByRole('button', { name: 'Add to merge queue' })
    )

    expect(store.getState().mergeOptions['pr-1']).toEqual(queueOptions)
  })

  it('offers "Merge when ready" without a method when a queued branch is blocked', async () => {
    await renderDrawer({
      mergeOptions: {
        ...queueOptions,
        mergeableState: 'blocked',
        viewerCanEnableAutoMerge: true
      }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Merge when ready' })
    )

    expect(mockEnableAutoMerge).toHaveBeenCalledWith({
      pullRequestId: 'pr-1'
    })
  })

  it('shows the queue position and removes the pull request from the queue', async () => {
    mockDequeuePullRequest.mockResolvedValue(queueOptions)

    const store = await renderDrawer({
      mergeOptions: {
        ...queueOptions,
        mergeQueueEntry: {
          enqueuedAt: '2026-10-14T10:00:00Z',
          estimatedTimeToMerge: 600,
          position: 2,
          state: 'AWAITING_CHECKS'
        }
      }
    })

    expect(screen.getByText('In merge queue')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The queue is running checks on this pull request. About 10 minutes until it merges.'
      )
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from merge queue' })
    )

    expect(mockDequeuePullRequest).toHaveBeenCalledWith('pr-1')
    expect(store.getState().mergeOptions['pr-1']).toEqual(queueOptions)
  })
})

describe('getMergeAction', () => {
  const queued: MergeOptions = {
    ...mergeableOptions,
    isMergeQueueEnabled: true
  }

  it('picks the action for each state', () => {
    expect([
      getMergeAction(null, false),
      getMergeAction(mergeableOptions, true),
      getMergeAction(blockedOptions, false),
      getMergeAction(
        { ...blockedOptions, viewerCanEnableAutoMerge: true },
        false
      ),
      getMergeAction(queued, true),
      getMergeAction({ ...queued, viewerCanEnableAutoMerge: true }, false),
      getMergeAction(
        {
          ...queued,
          mergeQueueEntry: {
            enqueuedAt: null,
            estimatedTimeToMerge: null,
            position: 1,
            state: 'QUEUED'
          }
        },
        true
      )
    ]).toEqual([
      'merge',
      'merge',
      'merge',
      'auto-merge',
      'enqueue',
      'merge-when-ready',
      'status'
    ])
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
