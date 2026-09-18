import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { SidebarFilterPopover } from './SidebarFilterPopover'
import { emptyFilters, type SidebarFilters } from './sidebar-data'
import { storyRows } from './sidebar-story-fixtures'

function Harness({ initial }: { initial: SidebarFilters }) {
  const [filters, setFilters] = useState(initial)

  return (
    <SidebarFilterPopover
      allRows={storyRows}
      filters={filters}
      onFiltersChange={setFilters}
      resultCount={storyRows.length}
    />
  )
}

const meta = {
  title: 'Components/SidebarFilterPopover',
  component: SidebarFilterPopover,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    allRows: storyRows,
    filters: emptyFilters,
    onFiltersChange: () => undefined,
    resultCount: storyRows.length
  }
} satisfies Meta<typeof SidebarFilterPopover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Harness initial={emptyFilters} />
}

export const WithActiveFilters: Story = {
  render: () => (
    <Harness
      initial={{
        authors: ['Artmann'],
        flags: ['Ready'],
        query: '',
        repos: ['Artmann/pull-panda-desktop']
      }}
    />
  )
}
