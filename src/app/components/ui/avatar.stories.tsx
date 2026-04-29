import type { Meta, StoryObj } from '@storybook/react-vite'

import { Avatar, AvatarFallback, AvatarImage } from './avatar'

const meta = {
  title: 'shadcn/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage
        src="https://github.com/shadcn.png"
        alt="@shadcn"
      />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  )
}

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>AP</AvatarFallback>
    </Avatar>
  )
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <Avatar className="size-6">
        <AvatarFallback>XS</AvatarFallback>
      </Avatar>
      <Avatar className="size-8">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar className="size-10">
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar className="size-14">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
      <Avatar className="size-20">
        <AvatarFallback>XL</AvatarFallback>
      </Avatar>
    </div>
  )
}

export const Stack: Story = {
  render: () => (
    <div className="flex -space-x-2">
      <Avatar className="ring-2 ring-background">
        <AvatarFallback>AA</AvatarFallback>
      </Avatar>
      <Avatar className="ring-2 ring-background">
        <AvatarFallback>BB</AvatarFallback>
      </Avatar>
      <Avatar className="ring-2 ring-background">
        <AvatarFallback>CC</AvatarFallback>
      </Avatar>
    </div>
  )
}
