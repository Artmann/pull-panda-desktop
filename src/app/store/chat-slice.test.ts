import { describe, expect, it } from 'vitest'

import type { ChatMessageRecord } from '@/types/chat'
import reducer, {
  chatActions,
  draftSessionKey,
  type ChatState
} from './chat-slice'

const emptyState: ChatState = {
  activeSessionIdByPullRequest: {},
  messagesBySession: {},
  sessionsByPullRequest: {},
  streamingBySession: {}
}

function userMessage(overrides: Partial<ChatMessageRecord>): ChatMessageRecord {
  return {
    content: 'Hello',
    createdAt: '2026-08-07T10:00:00.000Z',
    errorMessage: null,
    eventsJson: null,
    id: 'message-1',
    pullRequestId: 'PR_1',
    role: 'user',
    sessionId: 'session-1',
    ...overrides
  }
}

describe('chat slice', () => {
  it('buffers an optimistic message under the draft key when there is no session', () => {
    const state = reducer(
      emptyState,
      chatActions.userMessageSent({
        content: 'Hello',
        createdAt: '2026-08-07T10:00:00.000Z',
        pullRequestId: 'PR_1',
        sessionId: null,
        tempId: 'temp-1'
      })
    )

    expect(state.messagesBySession[draftSessionKey('PR_1')]).toEqual([
      userMessage({ id: 'temp-1', sessionId: '' })
    ])
  })

  it('moves the optimistic message to the real session when the run starts', () => {
    const afterSend = reducer(
      emptyState,
      chatActions.userMessageSent({
        content: 'Hello',
        createdAt: '2026-08-07T10:00:00.000Z',
        pullRequestId: 'PR_1',
        sessionId: null,
        tempId: 'temp-1'
      })
    )

    const state = reducer(
      afterSend,
      chatActions.runStarted({
        pullRequestId: 'PR_1',
        result: {
          assistantMessageId: 'streaming-1',
          sessionId: 'session-1',
          userMessage: userMessage({})
        },
        tempId: 'temp-1'
      })
    )

    expect(state.messagesBySession[draftSessionKey('PR_1')]).toEqual(undefined)
    expect(state.messagesBySession['session-1']).toEqual([userMessage({})])
    expect(state.activeSessionIdByPullRequest['PR_1']).toEqual('session-1')
    expect(state.streamingBySession['session-1']).toEqual({
      assistantMessageId: 'streaming-1',
      steps: [],
      text: ''
    })
  })

  it('accumulates deltas and tool-call steps while streaming', () => {
    const streamingState: ChatState = {
      ...emptyState,
      streamingBySession: {
        'session-1': { assistantMessageId: 'streaming-1', steps: [], text: '' }
      }
    }

    const afterDelta = reducer(
      streamingState,
      chatActions.deltaReceived({
        messageId: 'streaming-1',
        sessionId: 'session-1',
        text: 'Looking at the files.'
      })
    )
    const afterStep = reducer(
      afterDelta,
      chatActions.stepReceived({
        detail: '{"pullRequestId":"PR_1"}',
        messageId: 'streaming-1',
        name: 'mcp__pullpanda__list_files',
        sessionId: 'session-1'
      })
    )
    const state = reducer(
      afterStep,
      chatActions.deltaReceived({
        messageId: 'streaming-1',
        sessionId: 'session-1',
        text: 'Done.'
      })
    )

    expect(state.streamingBySession['session-1']).toEqual({
      assistantMessageId: 'streaming-1',
      steps: [
        {
          detail: '{"pullRequestId":"PR_1"}',
          name: 'mcp__pullpanda__list_files'
        }
      ],
      text: 'Looking at the files.\n\nDone.'
    })
  })

  it('appends the persisted message and clears streaming when the run completes', () => {
    const streamingState: ChatState = {
      ...emptyState,
      messagesBySession: { 'session-1': [userMessage({})] },
      streamingBySession: {
        'session-1': {
          assistantMessageId: 'streaming-1',
          steps: [],
          text: 'Partial'
        }
      }
    }

    const answer = userMessage({
      content: 'This PR adds a chat tab.',
      id: 'message-2',
      role: 'assistant'
    })
    const state = reducer(
      streamingState,
      chatActions.runCompleted({ message: answer, sessionId: 'session-1' })
    )

    expect(state.messagesBySession['session-1']).toEqual([
      userMessage({}),
      answer
    ])
    expect(state.streamingBySession['session-1']).toEqual(undefined)
  })

  it('turns a failed run into an assistant message with an error', () => {
    const streamingState: ChatState = {
      ...emptyState,
      messagesBySession: { 'session-1': [userMessage({})] },
      streamingBySession: {
        'session-1': {
          assistantMessageId: 'streaming-1',
          steps: [],
          text: 'Partial answer'
        }
      }
    }

    const state = reducer(
      streamingState,
      chatActions.runFailed({
        message: 'The agent exited unexpectedly (code 1).',
        messageId: 'streaming-1',
        sessionId: 'session-1'
      })
    )
    const failedMessage = state.messagesBySession['session-1']?.[1]

    expect(failedMessage).toEqual({
      content: 'Partial answer',
      createdAt: failedMessage?.createdAt ?? '',
      errorMessage: 'The agent exited unexpectedly (code 1).',
      eventsJson: null,
      id: 'streaming-1',
      pullRequestId: 'PR_1',
      role: 'assistant',
      sessionId: 'session-1'
    })
    expect(state.streamingBySession['session-1']).toEqual(undefined)
  })

  it('does not repeat a failure the agent already streamed as text', () => {
    const limitMessage =
      "You've hit your session limit · resets 11:40pm (Europe/Madrid)"
    const streamingState: ChatState = {
      ...emptyState,
      messagesBySession: { 'session-1': [userMessage({})] },
      streamingBySession: {
        'session-1': {
          assistantMessageId: 'streaming-1',
          steps: [],
          text: limitMessage
        }
      }
    }

    const state = reducer(
      streamingState,
      chatActions.runFailed({
        message: limitMessage,
        messageId: 'streaming-1',
        sessionId: 'session-1'
      })
    )
    const failedMessage = state.messagesBySession['session-1']?.[1]

    expect(failedMessage).toEqual({
      content: '',
      createdAt: failedMessage?.createdAt ?? '',
      errorMessage: limitMessage,
      eventsJson: null,
      id: 'streaming-1',
      pullRequestId: 'PR_1',
      role: 'assistant',
      sessionId: 'session-1'
    })
  })

  it('removes the optimistic message when the send is rolled back', () => {
    const afterSend = reducer(
      emptyState,
      chatActions.userMessageSent({
        content: 'Hello',
        createdAt: '2026-08-07T10:00:00.000Z',
        pullRequestId: 'PR_1',
        sessionId: 'session-1',
        tempId: 'temp-1'
      })
    )

    const state = reducer(
      afterSend,
      chatActions.sendRolledBack({
        pullRequestId: 'PR_1',
        sessionId: 'session-1',
        tempId: 'temp-1'
      })
    )

    expect(state.messagesBySession['session-1']).toEqual([])
  })

  it('tracks the active session per pull request', () => {
    const selected = reducer(
      emptyState,
      chatActions.sessionSelected({
        pullRequestId: 'PR_1',
        sessionId: 'session-1'
      })
    )
    const state = reducer(
      selected,
      chatActions.newChatStarted({ pullRequestId: 'PR_1' })
    )

    expect(selected.activeSessionIdByPullRequest['PR_1']).toEqual('session-1')
    expect(state.activeSessionIdByPullRequest['PR_1']).toEqual(null)
  })
})
