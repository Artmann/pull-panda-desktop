import type { Meta, StoryObj } from '@storybook/react-vite'

import { UserAvatar } from './UserAvatar'

const meta = {
  title: 'Components/UserAvatar',
  component: UserAvatar,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof UserAvatar>

export default meta

type Story = StoryObj<typeof meta>

export const WithImage: Story = {
  args: {
    login: 'octocat',
    avatarUrl: 'https://github.com/octocat.png'
  }
}

export const FallbackInitials: Story = {
  args: { login: 'Ada Lovelace' }
}

export const Unknown: Story = {
  args: {}
}

export const Stack: Story = {
  args: { login: 'octocat' },
  render: () => (
    <div className="flex -space-x-2">
      <UserAvatar
        login="octocat"
        avatarUrl="https://github.com/octocat.png"
      />
      <UserAvatar login="Ada Lovelace" />
      <UserAvatar login="Grace Hopper" />
      <UserAvatar />
    </div>
  )
}
