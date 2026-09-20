import { configureStore } from '@reduxjs/toolkit'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'

import type { MergeOptions } from '@/app/lib/api'
import connectedReposReducer from '@/app/store/connected-repos-slice'
import draftsReducer from '@/app/store/drafts-slice'
import mergeDrawerReducer from '@/app/store/merge-drawer-slice'
import mergeOptionsReducer from '@/app/store/merge-options-slice'
import pendingReviewCommentsReducer from '@/app/store/pending-review-comments-slice'
import pendingReviewsReducer from '@/app/store/pending-reviews-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import tasksReducer from '@/app/store/tasks-slice'
import type { Task } from '@/types/task'

import { createMockPullRequest } from './pull-requests/__test-helpers__/pull-request-fixtures'

import { AppFooter } from './AppFooter'
import { CommandContextProvider } from './commands/context'
import { AuthProvider } from './lib/store/authContext'
import { TasksProvider } from './lib/store/tasksContext'
import { PullRequestNavigationProvider } from './pull-requests/PullRequestNavigationProvider'

const win = window as unknown as {
  auth?: Record<string, unknown>
  electron?: Record<string, unknown>
}

// The footer reads the signed-in user and the running tasks over IPC, which
// Storybook has no main process for, so both bridges are stubbed here.
win.auth = {
  ...win.auth,
  getUser: () =>
    Promise.resolve({
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
      id: 1,
      login: 'octocat',
      name: 'The Octocat'
    })
}

win.electron = {
  ...win.electron,
  getApiPort: () => Promise.resolve(null),
  getTasks: () => Promise.resolve([]),
  onTaskUpdate: () => (): void => undefined
}

const mockPullRequest = createMockPullRequest({
  headRefName: 'feature/branch',
  baseRefName: 'main',
  repositoryName: 'demo',
  repositoryOwner: 'octocat'
})

const mergeableOptions: MergeOptions = {
  allowMergeCommit: true,
  allowRebaseMerge: true,
  allowSquashMerge: true,
  mergeable: true,
  mergeableState: 'clean',
  requirements: []
}

const runningTask: Task = {
  createdAt: '2026-01-01T00:00:00Z',
  id: 'task-1',
  message: 'Syncing pull requests…',
  status: 'running',
  type: 'syncPullRequests'
}

function buildStore(tasks: Task[]) {
  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false
      }),
    preloadedState: {
      connectedRepos: {
        byFullName: { 'octocat/demo': '/Users/me/code/demo' },
        checkoutsInProgress: {},
        initialized: true
      },
      drafts: {},
      mergeDrawer: { openForPullRequestId: null },
      mergeOptions: { 'pr-1': mergeableOptions },
      pendingReviewComments: {},
      pendingReviews: {},
      pullRequests: { initialized: true, items: [mockPullRequest] },
      tasks: { items: tasks }
    },
    reducer: {
      connectedRepos: connectedReposReducer,
      drafts: draftsReducer,
      mergeDrawer: mergeDrawerReducer,
      mergeOptions: mergeOptionsReducer,
      pendingReviewComments: pendingReviewCommentsReducer,
      pendingReviews: pendingReviewsReducer,
      pullRequests: pullRequestsReducer,
      tasks: tasksReducer
    }
  })
}

function renderFooter(route: string, tasks: Task[] = []): ReactElement {
  return (
    <Provider store={buildStore(tasks)}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <TasksProvider>
            <CommandContextProvider>
              <PullRequestNavigationProvider>
                <div className="flex h-40 w-full flex-col justify-end bg-background">
                  <AppFooter />
                </div>
              </PullRequestNavigationProvider>
            </CommandContextProvider>
          </TasksProvider>
        </AuthProvider>
      </MemoryRouter>
    </Provider>
  )
}

const meta = {
  title: 'Components/AppFooter',
  component: AppFooter,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs']
} satisfies Meta<typeof AppFooter>

export default meta

type Story = StoryObj<typeof meta>

// Away from a pull request the action region is empty, but the bar keeps its
// height so navigating never resizes the content above it.
export const AwayFromAPullRequest: Story = {
  render: () => renderFooter('/')
}

export const OnAPullRequest: Story = {
  render: () => renderFooter('/pull-requests/pr-1')
}

export const Syncing: Story = {
  render: () => renderFooter('/pull-requests/pr-1', [runningTask])
}
