import type { Meta, StoryObj } from '@storybook/react-vite'

import { SidebarViewSwitch } from './SidebarViewSwitch'

const meta = {
  title: 'Components/SidebarViewSwitch',
  component: SidebarViewSwitch,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    count: 8,
    hiddenCount: 5,
    onViewChange: () => undefined,
    view: 'main'
  },
  decorators: [
    (Story) => (
      <div className="bg-sidebar border-sidebar-border text-muted-foreground w-85 rounded-lg border px-3 py-2.5 text-2xs font-semibold tracking-wider uppercase">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SidebarViewSwitch>

export default meta

type Story = StoryObj<typeof meta>

/** The count, with a quiet link to the hidden pull requests beside it. */
export const Main: Story = {}

/** Inside the hidden view, the count leads back to the main list. */
export const Hidden: Story = {
  args: { count: 5, view: 'hidden' }
}

/** Nothing has been hidden, so only the count shows. */
export const NothingHidden: Story = {
  args: { hiddenCount: 0 }
}
