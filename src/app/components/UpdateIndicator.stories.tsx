import type { Meta, StoryObj } from '@storybook/react-vite'

import type { UpdateStatus } from '@/lib/updates'

import { UpdateIndicatorView } from './UpdateIndicator'

const readyStatus: UpdateStatus = {
  currentVersion: '1.6.0',
  lastCheckedAt: 1_700_000_000_000,
  message: null,
  releaseNotesUrl:
    'https://github.com/Artmann/pull-panda-desktop/releases/tag/v1.7.0',
  state: 'ready',
  version: '1.7.0'
}

const meta = {
  title: 'Components/UpdateIndicator',
  component: UpdateIndicatorView,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    isInstalling: false,
    onInstall: () => undefined,
    onOpenReleasePage: () => undefined,
    status: readyStatus
  }
} satisfies Meta<typeof UpdateIndicatorView>

export default meta

type Story = StoryObj<typeof meta>

export const Ready: Story = {}

export const Restarting: Story = {
  args: { isInstalling: true }
}

export const AvailableOnLinux: Story = {
  args: {
    status: {
      ...readyStatus,
      message:
        'Pull Panda cannot update itself on Linux. Download the latest .deb or .rpm from the release page.',
      state: 'available'
    }
  }
}

export const UnknownVersion: Story = {
  args: {
    status: {
      ...readyStatus,
      releaseNotesUrl:
        'https://github.com/Artmann/pull-panda-desktop/releases/latest',
      version: null
    }
  }
}

// Nothing renders while there is nothing to act on.
export const UpToDate: Story = {
  args: {
    status: {
      ...readyStatus,
      releaseNotesUrl: null,
      state: 'idle',
      version: null
    }
  }
}
