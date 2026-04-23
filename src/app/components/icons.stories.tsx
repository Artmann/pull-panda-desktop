import type { Meta, StoryObj } from '@storybook/react-vite'

import { GitHubLogoIcon, JiraLogoIcon, LinearLogoIcon } from './icons'

const meta = {
  title: 'Components/Icons',
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const All: Story = {
  render: () => (
    <div className="flex items-end gap-6 text-foreground">
      <div className="flex flex-col items-center gap-2">
        <GitHubLogoIcon className="size-10" />
        <span className="text-muted-foreground text-xs">GitHub</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LinearLogoIcon className="size-10" />
        <span className="text-muted-foreground text-xs">Linear</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <JiraLogoIcon className="size-10" />
        <span className="text-muted-foreground text-xs">Jira</span>
      </div>
    </div>
  )
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6 text-foreground">
      <GitHubLogoIcon className="size-4" />
      <GitHubLogoIcon className="size-6" />
      <GitHubLogoIcon className="size-8" />
      <GitHubLogoIcon className="size-12" />
      <GitHubLogoIcon className="size-16" />
    </div>
  )
}
