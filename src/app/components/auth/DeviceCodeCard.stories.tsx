import type { Meta, StoryObj } from '@storybook/react-vite'

import { DeviceCodeCard } from './DeviceCodeCard'

function noop(): void {
  return undefined
}

const meta = {
  title: 'Components/Auth/DeviceCodeCard',
  component: DeviceCodeCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof DeviceCodeCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    userCode: 'ABCD-1234',
    verificationUri: 'https://github.com/login/device',
    onOpenUrl: noop
  }
}
