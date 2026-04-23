import type { Meta, StoryObj } from '@storybook/react-vite'

import type { Review } from '@/types/pull-request-details'
import { ReviewBadge } from './ReviewBadge'

const baseReview: Review = {
  id: '1',
  gitHubId: 'r1',
  gitHubNumericId: 1,
  pullRequestId: 'pr1',
  state: 'COMMENTED',
  body: null,
  bodyHtml: null,
  url: null,
  authorLogin: 'octocat',
  authorAvatarUrl: 'https://github.com/octocat.png',
  gitHubCreatedAt: '2026-04-20T10:00:00Z',
  gitHubSubmittedAt: '2026-04-20T10:05:00Z',
  syncedAt: '2026-04-23T09:00:00Z'
}

const meta = {
  title: 'Components/ReviewBadge',
  component: ReviewBadge,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof ReviewBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Approved: Story = {
  args: { review: { ...baseReview, state: 'APPROVED' } }
}

export const ChangesRequested: Story = {
  args: { review: { ...baseReview, state: 'CHANGES_REQUESTED' } }
}

export const Commented: Story = {
  args: { review: baseReview }
}

export const WithoutAvatar: Story = {
  args: {
    review: {
      ...baseReview,
      state: 'APPROVED',
      authorAvatarUrl: null
    }
  }
}

export const AllStates: Story = {
  args: { review: baseReview },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ReviewBadge review={{ ...baseReview, state: 'APPROVED' }} />
      <ReviewBadge review={{ ...baseReview, state: 'CHANGES_REQUESTED' }} />
      <ReviewBadge review={baseReview} />
    </div>
  )
}
