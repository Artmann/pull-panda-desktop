import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { contentWithoutFailureMessage } from '@/lib/chat'
import type {
  ChatMessageRecord,
  ChatSendResult,
  ChatSessionRecord,
  ChatStep
} from '@/types/chat'

export interface ChatStreamingState {
  assistantMessageId: string
  steps: ChatStep[]
  text: string
}

export interface ChatState {
  activeSessionIdByPullRequest: Record<string, string | null | undefined>
  messagesBySession: Record<string, ChatMessageRecord[] | undefined>
  sessionsByPullRequest: Record<string, ChatSessionRecord[] | undefined>
  streamingBySession: Record<string, ChatStreamingState | undefined>
}

const initialState: ChatState = {
  activeSessionIdByPullRequest: {},
  messagesBySession: {},
  sessionsByPullRequest: {},
  streamingBySession: {}
}

// Messages sent before a session exists (first message of a new chat) are
// buffered under this key until the main process returns the real session id.
export function draftSessionKey(pullRequestId: string): string {
  return `new:${pullRequestId}`
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    deltaReceived: (
      state,
      action: PayloadAction<{
        messageId: string
        sessionId: string
        text: string
      }>
    ) => {
      const { messageId, sessionId, text } = action.payload
      const streaming = state.streamingBySession[sessionId]

      if (streaming && streaming.assistantMessageId === messageId) {
        streaming.text =
          streaming.text.length > 0 ? `${streaming.text}\n\n${text}` : text
      } else {
        state.streamingBySession[sessionId] = {
          assistantMessageId: messageId,
          steps: [],
          text
        }
      }
    },

    messagesLoaded: (
      state,
      action: PayloadAction<{
        messages: ChatMessageRecord[]
        sessionId: string
      }>
    ) => {
      state.messagesBySession[action.payload.sessionId] =
        action.payload.messages
    },

    newChatStarted: (
      state,
      action: PayloadAction<{ pullRequestId: string }>
    ) => {
      state.activeSessionIdByPullRequest[action.payload.pullRequestId] = null
    },

    runCompleted: (
      state,
      action: PayloadAction<{
        message: ChatMessageRecord
        sessionId: string
      }>
    ) => {
      const { message, sessionId } = action.payload
      const messages = state.messagesBySession[sessionId] ?? []

      messages.push(message)
      state.messagesBySession[sessionId] = messages

      delete state.streamingBySession[sessionId]
    },

    runFailed: (
      state,
      action: PayloadAction<{
        message: string
        messageId: string
        sessionId: string
      }>
    ) => {
      const { message, messageId, sessionId } = action.payload
      const streaming = state.streamingBySession[sessionId]
      const messages = state.messagesBySession[sessionId] ?? []
      const pullRequestId = messages[0]?.pullRequestId ?? ''

      messages.push({
        content: contentWithoutFailureMessage(streaming?.text ?? '', message),
        createdAt: new Date().toISOString(),
        errorMessage: message,
        eventsJson: null,
        id: messageId,
        pullRequestId,
        role: 'assistant',
        sessionId
      })
      state.messagesBySession[sessionId] = messages

      delete state.streamingBySession[sessionId]
    },

    runStarted: (
      state,
      action: PayloadAction<{
        pullRequestId: string
        result: ChatSendResult
        tempId: string
      }>
    ) => {
      const { pullRequestId, result, tempId } = action.payload
      const draftKey = draftSessionKey(pullRequestId)

      // The optimistic message lives either under the draft key (new chat) or
      // under the real session key (existing chat). Remove it from both and
      // replace it with the persisted record.
      const withoutTemp = (messages: ChatMessageRecord[] | undefined) =>
        (messages ?? []).filter((message) => message.id !== tempId)

      delete state.messagesBySession[draftKey]

      state.messagesBySession[result.sessionId] = [
        ...withoutTemp(state.messagesBySession[result.sessionId]),
        result.userMessage
      ]

      state.activeSessionIdByPullRequest[pullRequestId] = result.sessionId
      state.streamingBySession[result.sessionId] = {
        assistantMessageId: result.assistantMessageId,
        steps: [],
        text: ''
      }
    },

    sendRolledBack: (
      state,
      action: PayloadAction<{
        pullRequestId: string
        sessionId: string | null
        tempId: string
      }>
    ) => {
      const { pullRequestId, sessionId, tempId } = action.payload
      const key = sessionId ?? draftSessionKey(pullRequestId)

      state.messagesBySession[key] = (
        state.messagesBySession[key] ?? []
      ).filter((message) => message.id !== tempId)
    },

    sessionSelected: (
      state,
      action: PayloadAction<{
        pullRequestId: string
        sessionId: string
      }>
    ) => {
      state.activeSessionIdByPullRequest[action.payload.pullRequestId] =
        action.payload.sessionId
    },

    sessionsLoaded: (
      state,
      action: PayloadAction<{
        pullRequestId: string
        sessions: ChatSessionRecord[]
      }>
    ) => {
      state.sessionsByPullRequest[action.payload.pullRequestId] =
        action.payload.sessions
    },

    stepReceived: (
      state,
      action: PayloadAction<{
        detail: string | null
        messageId: string
        name: string
        sessionId: string
      }>
    ) => {
      const { detail, messageId, name, sessionId } = action.payload
      const streaming = state.streamingBySession[sessionId]

      if (streaming && streaming.assistantMessageId === messageId) {
        streaming.steps.push({ detail, name })
      } else {
        state.streamingBySession[sessionId] = {
          assistantMessageId: messageId,
          steps: [{ detail, name }],
          text: ''
        }
      }
    },

    userMessageSent: (
      state,
      action: PayloadAction<{
        content: string
        createdAt: string
        pullRequestId: string
        sessionId: string | null
        tempId: string
      }>
    ) => {
      const { content, createdAt, pullRequestId, sessionId, tempId } =
        action.payload
      const key = sessionId ?? draftSessionKey(pullRequestId)
      const messages = state.messagesBySession[key] ?? []

      messages.push({
        content,
        createdAt,
        errorMessage: null,
        eventsJson: null,
        id: tempId,
        pullRequestId,
        role: 'user',
        sessionId: sessionId ?? ''
      })
      state.messagesBySession[key] = messages
    }
  }
})

export const chatActions = chatSlice.actions

export default chatSlice.reducer
