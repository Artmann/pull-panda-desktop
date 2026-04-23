import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Pagination } from './Pagination'

function noop(): void {
  return undefined
}

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

function Interactive({ totalPages }: { totalPages: number }) {
  const [page, setPage] = useState(1)

  return (
    <Pagination
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  )
}

export const Default: Story = {
  args: { currentPage: 1, totalPages: 5, onPageChange: noop },
  render: () => <Interactive totalPages={5} />
}

export const FirstPage: Story = {
  args: { currentPage: 1, totalPages: 10, onPageChange: noop }
}

export const Middle: Story = {
  args: { currentPage: 5, totalPages: 10, onPageChange: noop }
}

export const LastPage: Story = {
  args: { currentPage: 10, totalPages: 10, onPageChange: noop }
}

export const Hidden: Story = {
  args: { currentPage: 1, totalPages: 1, onPageChange: noop }
}
