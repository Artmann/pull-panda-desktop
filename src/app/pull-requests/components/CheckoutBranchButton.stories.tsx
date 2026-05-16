import { configureStore } from '@reduxjs/toolkit'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import connectedReposReducer from '@/app/store/connected-repos-slice'
import type { PullRequest } from '@/types/pull-request'

import { CheckoutBranchButton } from './CheckoutBranchButton'

const win = window as unknown as {
  electron?: { getApiPort: () => Promise<number | null> }
}

if (!win.electron) {
  win.electron = { getApiPort: () => Promise.resolve(null) }
}

function buildStore(connectedFullName?: string) {
  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false
      }),
    preloadedState: {
      connectedRepos: {
        byFullName: connectedFullName
          ? { [connectedFullName]: '/Users/me/code/demo' }
          : {},
        checkoutsInProgress: {},
        initialized: true
      }
    },
    reducer: {
      connectedRepos: connectedReposReducer
    }
  })
}

const mockPullRequest: PullRequest = {
  approvalCount: 0,
  assignees: [],
  requestedReviewers: [],
  authorAvatarUrl: null,
  authorLogin: 'octocat',
  body: null,
  bodyHtml: null,
  changesRequestedCount: 0,
  closedAt: null,
  commentCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  detailsSyncedAt: null,
  headRefName: 'feature/branch',
  id: 'pr-1',
  isAssignee: false,
  isAuthor: false,
  isDraft: false,
  isReviewer: true,
  labels: [],
  mergedAt: null,
  number: 42,
  repositoryName: 'demo',
  repositoryOwner: 'octocat',
  state: 'OPEN',
  syncedAt: '2026-01-01T00:00:00Z',
  title: 'Demo PR',
  updatedAt: '2026-01-01T00:00:00Z',
  url: 'https://example.com'
}

const meta = {
  title: 'Components/CheckoutBranchButton',
  component: CheckoutBranchButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof CheckoutBranchButton>

export default meta

type Story = StoryObj<typeof meta>

export const NotConnected: Story = {
  args: { pullRequest: mockPullRequest },
  decorators: [
    (Story) => (
      <Provider store={buildStore()}>
        <Story />
      </Provider>
    )
  ]
}

export const Connected: Story = {
  args: { pullRequest: mockPullRequest },
  decorators: [
    (Story) => (
      <Provider store={buildStore('octocat/demo')}>
        <Story />
      </Provider>
    )
  ]
}

export const HeadBranchMissing: Story = {
  args: {
    pullRequest: { ...mockPullRequest, headRefName: null }
  },
  decorators: [
    (Story) => (
      <Provider store={buildStore('octocat/demo')}>
        <Story />
      </Provider>
    )
  ]
}
