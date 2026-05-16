import type { Meta, StoryObj } from '@storybook/react-vite'

import { UserAvatar } from '../components/UserAvatar'
import {
  ReviewerStatusIndicator,
  type ReviewerStatus
} from './ReviewerStatusIndicator'

const meta = {
  title: 'Components/ReviewerStatusIndicator',
  component: ReviewerStatusIndicator,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof ReviewerStatusIndicator>

export default meta

type Story = StoryObj<typeof meta>

function AvatarWithStatus({ status }: { status: ReviewerStatus }) {
  return (
    <div className="relative inline-block">
      <UserAvatar
        avatarUrl="https://github.com/octocat.png"
        login="octocat"
      />
      <ReviewerStatusIndicator status={status} />
    </div>
  )
}

export const Approved: Story = {
  args: { status: 'approved' },
  render: (args) => <AvatarWithStatus status={args.status} />
}

export const ChangesRequested: Story = {
  args: { status: 'changes-requested' },
  render: (args) => <AvatarWithStatus status={args.status} />
}

export const Commented: Story = {
  args: { status: 'commented' },
  render: (args) => <AvatarWithStatus status={args.status} />
}

export const Pending: Story = {
  args: { status: 'pending' },
  render: (args) => <AvatarWithStatus status={args.status} />
}

export const AllStates: Story = {
  args: { status: 'approved' },
  render: () => (
    <div className="flex gap-3">
      <AvatarWithStatus status="approved" />
      <AvatarWithStatus status="changes-requested" />
      <AvatarWithStatus status="commented" />
      <AvatarWithStatus status="pending" />
    </div>
  )
}
