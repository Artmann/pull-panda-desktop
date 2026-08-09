import type { Meta, StoryObj } from '@storybook/react-vite'

import type { DetectedAgent } from '@/main/agents/agent-detection'
import type { AgentSettings } from '@/main/agents/agent-settings'

import { AgentsSettings } from './agents'

const detected: DetectedAgent[] = [
  {
    displayName: 'Claude Code',
    id: 'claude',
    path: 'C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd',
    source: 'path',
    version: '2.1.0 (Claude Code)'
  },
  {
    displayName: 'Codex',
    id: 'codex',
    path: null,
    source: null,
    version: null
  }
]

const settings: AgentSettings = {
  defaultAgent: 'claude',
  overrides: {}
}

function stubAgentsApi(agents: DetectedAgent[]) {
  const win = window as unknown as { agents: unknown }

  win.agents = {
    detect: () => Promise.resolve(agents),
    getSettings: () => Promise.resolve(settings),
    pickBinary: () => Promise.resolve({ path: null }),
    setDefault: () => Promise.resolve(settings),
    setOverride: () => Promise.resolve(settings)
  }
}

const meta = {
  title: 'Components/AgentsSettings',
  component: AgentsSettings,
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta<typeof AgentsSettings>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    (Story) => {
      stubAgentsApi(detected)

      return <Story />
    }
  ]
}

export const NothingDetected: Story = {
  decorators: [
    (Story) => {
      stubAgentsApi(
        detected.map(
          (agent): DetectedAgent => ({
            ...agent,
            path: null,
            source: null,
            version: null
          })
        )
      )

      return <Story />
    }
  ]
}
