import type { Meta, StoryObj } from '@storybook/react-vite'

import { Bubble, BubbleContent } from './bubble'
import { Message, MessageContent } from './message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport
} from './message-scroller'

const meta = {
  title: 'shadcn/MessageScroller',
  component: MessageScroller,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof MessageScroller>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="h-96 w-96">
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-4 py-4">
              {Array.from({ length: 20 }, (_, index) => (
                <MessageScrollerItem key={index}>
                  <Message align={index % 2 === 0 ? 'end' : 'start'}>
                    <MessageContent>
                      <Bubble
                        align={index % 2 === 0 ? 'end' : 'start'}
                        variant={index % 2 === 0 ? 'secondary' : 'ghost'}
                      >
                        <BubbleContent>
                          Message number {index + 1}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>

          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}
