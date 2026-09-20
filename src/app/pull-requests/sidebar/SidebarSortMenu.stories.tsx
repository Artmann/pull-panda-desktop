import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { SidebarSortMenu } from './SidebarSortMenu'
import type { SortId } from './sidebar-data'

function Harness({ initial }: { initial: SortId }) {
  const [sort, setSort] = useState<SortId>(initial)

  return (
    <SidebarSortMenu
      onSortChange={setSort}
      sort={sort}
    />
  )
}

const meta = {
  title: 'Components/SidebarSortMenu',
  component: SidebarSortMenu,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { onSortChange: () => undefined, sort: 'needs' },
  decorators: [
    // The caption row the trigger lives in, caps and all, so the story shows
    // whether the trigger's own casing survives the inheritance.
    (Story) => (
      <div className="bg-sidebar text-muted-foreground border-sidebar-border flex w-85 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-2xs font-semibold tracking-wider uppercase">
        <span className="shrink-0 whitespace-nowrap">10 pull requests</span>

        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SidebarSortMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Harness initial="needs" />
}

export const SortedByAuthor: Story = {
  render: () => <Harness initial="author" />
}
