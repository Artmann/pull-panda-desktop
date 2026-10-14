import type { Meta, StoryObj } from '@storybook/react-vite'

import { PullRequestStatusStrip } from './PullRequestStatusStrip'

const meta = {
  title: 'Components/PullRequestStatusStrip',
  component: PullRequestStatusStrip,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    onSelectTab: () => undefined,
    summary: {
      cells: [
        {
          detail: 'GitHub Actions, Vercel',
          key: 'checks',
          label: 'Checks',
          tab: 'checks',
          tone: 'success',
          value: '6/6 passed'
        },
        {
          detail: 'No reviewers assigned',
          key: 'reviews',
          label: 'Reviews',
          tab: 'tasks',
          tone: 'neutral',
          value: 'Not required'
        },
        {
          detail: '1 bot comment',
          key: 'comments',
          label: 'Comments',
          tab: 'overview',
          tone: 'success',
          value: 'None open'
        },
        {
          detail: 'Up to date with main',
          key: 'branch',
          label: 'Branch',
          tab: 'tasks',
          tone: 'success',
          value: 'No conflicts'
        }
      ],
      tone: 'success'
    }
  },
  decorators: [
    (Story) => (
      <div className="max-w-content">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof PullRequestStatusStrip>

export default meta

type Story = StoryObj<typeof meta>

export const Ready: Story = {}

export const Waiting: Story = {
  args: {
    summary: {
      cells: [
        {
          detail: '2 of 3 passed',
          key: 'checks',
          label: 'Checks',
          tab: 'checks',
          tone: 'warning',
          value: '1 running'
        },
        {
          detail: 'Waiting on matheusfelipeog',
          key: 'reviews',
          label: 'Reviews',
          tab: 'tasks',
          tone: 'warning',
          value: 'Waiting'
        },
        {
          detail: 'No comments yet',
          key: 'comments',
          label: 'Comments',
          tab: 'overview',
          tone: 'success',
          value: 'None open'
        },
        {
          detail: 'Up to date with master',
          key: 'branch',
          label: 'Branch',
          tab: 'tasks',
          tone: 'success',
          value: 'No conflicts'
        }
      ],
      tone: 'warning'
    }
  }
}

export const Blocked: Story = {
  args: {
    summary: {
      cells: [
        {
          detail: '5 passed · 1 running',
          key: 'checks',
          label: 'Checks',
          tab: 'checks',
          tone: 'danger',
          value: '1 failing'
        },
        {
          detail: 'mira',
          key: 'reviews',
          label: 'Reviews',
          tab: 'tasks',
          tone: 'danger',
          value: 'Changes requested'
        },
        {
          detail: 'Across 3 files',
          key: 'comments',
          label: 'Comments',
          tab: 'tasks',
          tone: 'warning',
          value: '3 unresolved'
        },
        {
          detail: 'Up to date with main',
          key: 'branch',
          label: 'Branch',
          tab: 'tasks',
          tone: 'success',
          value: 'No conflicts'
        }
      ],
      tone: 'danger'
    }
  }
}
