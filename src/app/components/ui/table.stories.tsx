import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './table'

const meta = {
  title: 'shadcn/Table',
  component: Table,
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

const rows = [
  { number: 42, title: 'Add Storybook', author: 'artgaard', status: 'Open' },
  {
    number: 41,
    title: 'Fix scroll position',
    author: 'artgaard',
    status: 'Merged'
  },
  { number: 40, title: 'Reduce header sizes', author: 'octocat', status: 'Merged' },
  { number: 39, title: 'Add fallow script', author: 'octocat', status: 'Closed' }
]

export const Default: Story = {
  render: () => (
    <div className="w-[640px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Author</TableHead>
            <TableHead className="w-24">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.number}>
              <TableCell className="text-muted-foreground">
                {row.number}
              </TableCell>
              <TableCell className="font-medium">{row.title}</TableCell>
              <TableCell>{row.author}</TableCell>
              <TableCell>{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
