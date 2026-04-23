import type { Meta, StoryObj } from '@storybook/react-vite'

import { SectionHeader } from './SectionHeader'

const meta = {
  title: 'Components/SectionHeader',
  component: SectionHeader,
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta<typeof SectionHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: 'Needs your review' }
}

export const Multiple: Story = {
  args: { children: 'Placeholder' },
  render: () => (
    <div className="flex flex-col gap-6">
      <SectionHeader>Needs your review</SectionHeader>
      <SectionHeader>Your pull requests</SectionHeader>
      <SectionHeader>Recently merged</SectionHeader>
    </div>
  )
}
