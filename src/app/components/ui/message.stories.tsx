import type { Meta, StoryObj } from '@storybook/react-vite'

import { Bubble, BubbleContent } from './bubble'
import { Message, MessageContent, MessageGroup, MessageHeader } from './message'

const meta = {
  title: 'shadcn/Message',
  component: Message,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Message>

export default meta

type Story = StoryObj<typeof meta>

export const Conversation: Story = {
  render: () => (
    <MessageGroup className="w-96">
      <Message align="end">
        <MessageContent>
          <Bubble
            align="end"
            variant="secondary"
          >
            <BubbleContent>What does this PR change?</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>

      <Message>
        <MessageContent>
          <MessageHeader>Claude Code</MessageHeader>
          <Bubble variant="ghost">
            <BubbleContent>
              It adds a chat tab to the pull request page.
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </MessageGroup>
  )
}
