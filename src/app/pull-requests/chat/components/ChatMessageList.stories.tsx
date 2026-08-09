import type { Meta, StoryObj } from '@storybook/react-vite'

import { ThemeProvider } from '@/app/lib/store/themeContext'
import type { ChatMessageRecord } from '@/types/chat'

import { ChatMessageList } from './ChatMessageList'

function message(overrides: Partial<ChatMessageRecord>): ChatMessageRecord {
  return {
    content: '',
    createdAt: '2026-08-07T10:00:00.000Z',
    errorMessage: null,
    eventsJson: null,
    id: Math.random().toString(36).slice(2),
    pullRequestId: 'PR_1',
    role: 'user',
    sessionId: 'session-1',
    ...overrides
  }
}

const conversation: ChatMessageRecord[] = [
  message({ content: 'What does this PR change?' }),
  message({
    content:
      'This PR adds a **Chat tab** to the pull request page:\n\n- Detects installed agent CLIs\n- Streams answers into the UI\n- Persists chat history in SQLite',
    eventsJson: JSON.stringify([
      {
        detail: '{"pullRequestId":"PR_1"}',
        name: 'mcp__pullpanda__read_pull_request'
      },
      { detail: '{"pullRequestId":"PR_1"}', name: 'mcp__pullpanda__list_files' }
    ]),
    role: 'assistant'
  }),
  message({ content: 'Any risky parts I should review closely?' })
]

const meta = {
  title: 'Components/ChatMessageList',
  component: ChatMessageList,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div className="h-120 w-160">
          <Story />
        </div>
      </ThemeProvider>
    )
  ],
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof ChatMessageList>

export default meta

type Story = StoryObj<typeof meta>

export const Conversation: Story = {
  args: {
    messages: conversation,
    streaming: null
  }
}

export const Streaming: Story = {
  args: {
    messages: conversation,
    streaming: {
      assistantMessageId: 'streaming-1',
      steps: [
        {
          detail: '{"pullRequestId":"PR_1"}',
          name: 'mcp__pullpanda__get_file_diff'
        }
      ],
      text: 'Looking at the diff, the riskiest part is the process spawning logic…'
    }
  }
}

export const WithError: Story = {
  args: {
    messages: [
      message({ content: 'What does this PR change?' }),
      message({
        errorMessage:
          'The Claude Code binary was not found. Configure it under Settings → Agents.',
        role: 'assistant'
      })
    ],
    streaming: null
  }
}
