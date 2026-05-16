import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import {
  buildReviewerStoryStore,
  reviewerStoryPullRequest
} from './__test-helpers__/reviewer-fixtures'
import { ReviewerPicker } from './ReviewerPicker'

const meta = {
  title: 'Components/ReviewerPicker',
  component: ReviewerPicker,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof ReviewerPicker>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { pullRequest: reviewerStoryPullRequest },
  decorators: [
    (Story) => (
      <Provider
        store={buildReviewerStoryStore({
          recents: {
            'octocat/demo': [
              {
                avatarUrl: 'https://github.com/alice.png',
                lastUsedAt: '2026-04-20T10:05:00Z',
                login: 'alice',
                useCount: 5
              },
              {
                avatarUrl: 'https://github.com/bob.png',
                lastUsedAt: '2026-04-19T10:05:00Z',
                login: 'bob',
                useCount: 3
              }
            ]
          }
        })}
      >
        <div className="min-h-96">
          <Story />
        </div>
      </Provider>
    )
  ]
}
