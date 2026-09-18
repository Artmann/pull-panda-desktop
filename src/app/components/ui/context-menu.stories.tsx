import type { Meta, StoryObj } from '@storybook/react-vite'
import { CopyIcon, ExternalLinkIcon, GitBranchIcon } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from './context-menu'

const meta = {
  title: 'shadcn/ContextMenu',
  component: ContextMenu,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof ContextMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="border-border text-muted-foreground flex h-32 w-80 items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem>
          <ExternalLinkIcon />
          Open in GitHub
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem>
          <CopyIcon />
          Copy GitHub link
        </ContextMenuItem>

        <ContextMenuItem disabled>
          <GitBranchIcon />
          Copy branch name
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
