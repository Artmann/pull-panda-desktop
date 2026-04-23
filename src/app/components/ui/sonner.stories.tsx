import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'

import { Button } from './button'
import { Toaster } from './sonner'

const meta = {
  title: 'shadcn/Sonner',
  component: Toaster,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Toaster>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => toast('Event has been created')}>Default</Button>
      <Button
        variant="outline"
        onClick={() => toast.success('Pull request merged')}
      >
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info('New commits pushed')}
      >
        Info
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.warning('Merge conflicts detected')}
      >
        Warning
      </Button>
      <Button
        variant="destructive"
        onClick={() => toast.error('Failed to authenticate')}
      >
        Error
      </Button>
      <Toaster />
    </div>
  )
}
