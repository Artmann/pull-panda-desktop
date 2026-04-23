import type { Meta, StoryObj } from '@storybook/react-vite'
import { TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from './alert'

const meta = {
  title: 'shadcn/Alert',
  component: Alert,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive'] }
  }
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <div className="w-96">
      <Alert {...args}>
        <TriangleAlertIcon />
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          You can customize alerts using the variants prop.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export const Destructive: Story = {
  args: { variant: 'destructive' },
  render: (args) => (
    <div className="w-96">
      <Alert {...args}>
        <TriangleAlertIcon />
        <AlertTitle>Authentication failed</AlertTitle>
        <AlertDescription>
          Your GitHub token may have expired. Re-authenticate to continue.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export const NoIcon: Story = {
  render: () => (
    <div className="w-96">
      <Alert>
        <AlertTitle>Compact alert</AlertTitle>
        <AlertDescription>Works without a leading icon too.</AlertDescription>
      </Alert>
    </div>
  )
}
