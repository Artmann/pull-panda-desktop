import type { Meta, StoryObj } from '@storybook/react-vite'

import { DeploymentCard } from './DeploymentCard'

const meta = {
  title: 'Components/DeploymentCard',
  component: DeploymentCard,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    deployments: [
      {
        previewUrl: 'https://bitesized-git-qr.vercel.app',
        project: 'bitesized',
        status: 'Ready',
        updated: 'Oct 14, 2026 7:12am UTC'
      }
    ]
  },
  decorators: [
    (Story) => (
      <div className="max-w-content">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof DeploymentCard>

export default meta

type Story = StoryObj<typeof meta>

export const Ready: Story = {}

export const Building: Story = {
  args: {
    deployments: [
      {
        previewUrl: null,
        project: 'docs',
        status: 'Building',
        updated: 'Oct 14, 2026 7:12am UTC'
      }
    ]
  }
}

export const SeveralProjects: Story = {
  args: {
    deployments: [
      {
        previewUrl: 'https://web-git-qr.vercel.app',
        project: 'web',
        status: 'Ready',
        updated: 'Oct 14, 2026 7:12am UTC'
      },
      {
        previewUrl: null,
        project: 'admin',
        status: 'Error',
        updated: 'Oct 14, 2026 7:10am UTC'
      },
      {
        previewUrl: null,
        project: 'storybook',
        status: 'Canceled',
        updated: 'Oct 14, 2026 7:08am UTC'
      }
    ]
  }
}
