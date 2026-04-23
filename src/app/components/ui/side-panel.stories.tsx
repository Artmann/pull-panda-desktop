import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import {
  SidePanel,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle
} from './side-panel'

const meta = {
  title: 'shadcn/SidePanel',
  component: SidePanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs']
} satisfies Meta<typeof SidePanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: null },
  render: () => (
    <div className="relative h-screen w-full bg-muted/20">
      <div className="p-8 text-sm text-muted-foreground">
        Main app content goes here. The side panel is docked to the right.
      </div>
      <SidePanel>
        <SidePanelHeader>
          <SidePanelTitle>PR #42</SidePanelTitle>
          <SidePanelDescription>Add Storybook setup</SidePanelDescription>
        </SidePanelHeader>
        <SidePanelContent className="px-4">
          <p className="text-sm">
            This is the main content area of the side panel. It scrolls when
            content overflows.
          </p>
        </SidePanelContent>
        <SidePanelFooter>
          <Button size="sm" className="w-full">
            Approve
          </Button>
        </SidePanelFooter>
      </SidePanel>
    </div>
  )
}

export const Collapsed: Story = {
  args: { children: null, collapsed: true },
  render: () => (
    <div className="relative h-screen w-full bg-muted/20">
      <div className="p-8 text-sm text-muted-foreground">
        Side panel in collapsed state.
      </div>
      <SidePanel collapsed>
        <SidePanelHeader collapsed>
          <SidePanelTitle>Hidden</SidePanelTitle>
        </SidePanelHeader>
      </SidePanel>
    </div>
  )
}
