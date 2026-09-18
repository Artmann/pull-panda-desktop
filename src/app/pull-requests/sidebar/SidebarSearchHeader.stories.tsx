import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { SidebarSearchHeader } from './SidebarSearchHeader'
import {
  emptyFilters,
  filterRows,
  type SidebarFilters,
  type SortId
} from './sidebar-data'
import { storyRows } from './sidebar-story-fixtures'

function Harness({ initial }: { initial: SidebarFilters }) {
  const [filters, setFilters] = useState(initial)
  const [sort, setSort] = useState<SortId>('needs')

  return (
    <SidebarSearchHeader
      allRows={storyRows}
      filters={filters}
      onFiltersChange={setFilters}
      onSortChange={setSort}
      resultCount={filterRows(storyRows, filters).length}
      sort={sort}
    />
  )
}

const meta = {
  title: 'Components/SidebarSearchHeader',
  component: SidebarSearchHeader,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    allRows: storyRows,
    filters: emptyFilters,
    onFiltersChange: () => undefined,
    onSortChange: () => undefined,
    resultCount: storyRows.length,
    sort: 'needs'
  },
  decorators: [
    (Story) => (
      <div className="bg-sidebar border-sidebar-border w-85 rounded-lg border">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SidebarSearchHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Harness initial={emptyFilters} />
}

export const Searching: Story = {
  render: () => <Harness initial={{ ...emptyFilters, query: 'tests' }} />
}

export const Filtered: Story = {
  render: () => (
    <Harness
      initial={{
        ...emptyFilters,
        flags: ['Ready'],
        repos: ['Artmann/pull-panda-desktop']
      }}
    />
  )
}
