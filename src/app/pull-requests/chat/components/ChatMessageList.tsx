import { BotIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link, useParams } from 'react-router'

import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import { useAppSelector } from '@/app/store/hooks'
import { Bubble, BubbleContent } from '@/app/components/ui/bubble'
import { Marker, MarkerContent, MarkerIcon } from '@/app/components/ui/marker'
import { Message, MessageContent } from '@/app/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport
} from '@/app/components/ui/message-scroller'
import type { ChatStreamingState } from '@/app/store/chat-slice'
import type { ChatMessageRecord, ChatStep } from '@/types/chat'

// Inline code that names a file changed by this pull request becomes a link
// to that file's diff in the Files tab. Everything else renders as plain code.
function FileLinkCode({
  children,
  className,
  ...props
}: React.ComponentProps<'code'>): ReactElement {
  const { id: pullRequestId } = useParams<{ id: string }>()

  const text = typeof children === 'string' ? children : null
  // Agents often cite locations as `src/app.ts:12` — link the file anyway.
  const filePath = text?.replace(/:\d+(?:-\d+)?$/, '') ?? null

  const isChangedFile = useAppSelector(
    (state) =>
      filePath !== null &&
      pullRequestId !== undefined &&
      // Fenced blocks carry a language-* class; only inline code links.
      className === undefined &&
      state.modifiedFiles.items.some(
        (file) =>
          file.pullRequestId === pullRequestId && file.filePath === filePath
      )
  )

  if (!isChangedFile || filePath === null) {
    return (
      <code
        className={className}
        {...props}
      >
        {children}
      </code>
    )
  }

  return (
    <Link
      to={`/pull-requests/${pullRequestId}?tab=files&file=${encodeURIComponent(filePath)}`}
    >
      <code {...props}>{children}</code>
    </Link>
  )
}

const chatMarkdownComponents = { code: FileLinkCode }

// Turns a raw tool name like "mcp__pullpanda__get_file_diff" into a readable
// live status label.
function describeStep(step: ChatStep): string {
  const name = step.name.replace(/^mcp__[a-z0-9-]+__/i, '').replaceAll('_', ' ')

  return `Using ${name}…`
}

function ChatMessageItem({
  message
}: {
  message: ChatMessageRecord
}): ReactElement {
  if (message.role === 'user') {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble
            align="end"
            variant="secondary"
          >
            <BubbleContent className="whitespace-pre-wrap">
              {message.content}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message>
      <MessageContent>
        {message.content.length > 0 && (
          <Bubble variant="ghost">
            <BubbleContent>
              <MarkdownBlock
                className="prose-sm"
                components={chatMarkdownComponents}
                content={message.content}
              />
            </BubbleContent>
          </Bubble>
        )}

        {message.errorMessage && (
          <Bubble variant="destructive">
            <BubbleContent>{message.errorMessage}</BubbleContent>
          </Bubble>
        )}
      </MessageContent>
    </Message>
  )
}

function StreamingMessage({
  streaming
}: {
  streaming: ChatStreamingState
}): ReactElement {
  const currentStep = streaming.steps.at(-1)

  return (
    <Message>
      <MessageContent>
        {streaming.text.length > 0 && (
          <Bubble variant="ghost">
            <BubbleContent>
              <MarkdownBlock
                className="prose-sm"
                components={chatMarkdownComponents}
                content={streaming.text}
              />
            </BubbleContent>
          </Bubble>
        )}

        <Marker>
          <MarkerIcon>
            <BotIcon />
          </MarkerIcon>
          <MarkerContent className="shimmer">
            {currentStep ? describeStep(currentStep) : 'Working…'}
          </MarkerContent>
        </Marker>
      </MessageContent>
    </Message>
  )
}

export function ChatMessageList({
  messages,
  streaming
}: {
  messages: ChatMessageRecord[]
  streaming: ChatStreamingState | null
}): ReactElement {
  return (
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          {/* pe-4 keeps message text off the viewport's scrollbar. */}
          <MessageScrollerContent className="gap-4 py-4 pe-4">
            {messages.map((message) => (
              <MessageScrollerItem key={message.id}>
                <ChatMessageItem message={message} />
              </MessageScrollerItem>
            ))}

            {streaming && (
              <MessageScrollerItem scrollAnchor>
                <StreamingMessage streaming={streaming} />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
