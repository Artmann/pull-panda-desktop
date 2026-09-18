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
  args: { onSortChange: () => undefined, sort: 'needs' }
} satisfies Meta<typeof SidebarSortMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Harness initial="needs" />
}

export const SortedByAuthor: Story = {
  render: () => <Harness initial="author" />
}
