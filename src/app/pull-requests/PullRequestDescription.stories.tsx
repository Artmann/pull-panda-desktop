import { configureStore } from '@reduxjs/toolkit'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import draftsReducer from '@/app/store/drafts-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'

import { reviewerStoryPullRequest } from './__test-helpers__/reviewer-fixtures'
import { PullRequestDescription } from './PullRequestDescription'

const body = [
  '## Problem',
  '',
  'Every restaurant had one QR code, so you could not tell which table a guest was at.',
  '',
  '## Changes',
  '',
  '- **Table codes.** Each table gets its own code.',
  '- **Print page.** Print any set of tables as cards or stickers.',
  '',
  '```ts',
  'const code = createCode({ table: 4 })',
  '```'
].join('\n')

function buildStore() {
  return configureStore({
    preloadedState: { drafts: {} },
    reducer: { drafts: draftsReducer, pullRequests: pullRequestsReducer }
  })
}

const meta = {
  title: 'Components/PullRequestDescription',
  component: PullRequestDescription,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { pullRequest: { ...reviewerStoryPullRequest, body } },
  decorators: [
    (Story) => (
      <Provider store={buildStore()}>
        <div className="max-w-content">
          <Story />
        </div>
      </Provider>
    )
  ]
} satisfies Meta<typeof PullRequestDescription>

export default meta

type Story = StoryObj<typeof meta>

/** Right-click anywhere on the description for the menu. */
export const WithDescription: Story = {}

export const Empty: Story = {
  args: { pullRequest: { ...reviewerStoryPullRequest, body: null } }
}

/** Merged pull requests can no longer be edited, so the button goes away. */
export const Merged: Story = {
  args: {
    pullRequest: { ...reviewerStoryPullRequest, body, state: 'MERGED' }
  }
}
