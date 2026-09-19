import type { Meta, StoryObj } from '@storybook/react-vite'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'

import checksReducer from '@/app/store/checks-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import type { PullRequest } from '@/types/pull-request'

import { PullRequestNavigationProvider } from '../PullRequestNavigationProvider'
import { PullRequestSidebar } from './PullRequestSidebar'
import { storyRows } from './sidebar-story-fixtures'

const pullRequests: PullRequest[] = storyRows.map((row) => row.pullRequest)

function buildStore(items: PullRequest[]) {
  return configureStore({
    reducer: { checks: checksReducer, pullRequests: pullRequestsReducer },
    preloadedState: {
      checks: { items: [] },
      pullRequests: { initialized: true, items }
    }
  })
}

function Harness({
  initialPath = '/',
  items = pullRequests
}: {
  initialPath?: string
  items?: PullRequest[]
}) {
  return (
    <Provider store={buildStore(items)}>
      <MemoryRouter initialEntries={[initialPath]}>
        <PullRequestNavigationProvider>
          <div className="border-border flex h-160 rounded-lg border">
            <PullRequestSidebar />

            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              Pull request detail
            </div>
          </div>
        </PullRequestNavigationProvider>
      </MemoryRouter>
    </Provider>
  )
}

const meta = {
  title: 'Components/PullRequestSidebar',
  component: PullRequestSidebar,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs']
} satisfies Meta<typeof PullRequestSidebar>

export default meta

type Story = StoryObj<typeof meta>

export const NothingSelected: Story = {
  render: () => <Harness />
}

export const WithSelection: Story = {
  render: () => <Harness initialPath="/pull-requests/pr-55" />
}

export const Empty: Story = {
  render: () => <Harness items={[]} />
}
