import type { UnknownAction } from '@reduxjs/toolkit'

import { chatActions } from '@/app/store/chat-slice'
import type { ChatEvent } from '@/types/chat'

// Maps a chat event pushed from the main process to the Redux action that
// applies it to the store.
export function chatEventToAction(event: ChatEvent): UnknownAction {
  switch (event.kind) {
    case 'assistant-delta':
      return chatActions.deltaReceived({
        messageId: event.messageId,
        sessionId: event.sessionId,
        text: event.text
      })

    case 'done':
      return chatActions.runCompleted({
        message: event.message,
        sessionId: event.sessionId
      })

    case 'error':
      return chatActions.runFailed({
        message: event.message,
        messageId: event.messageId,
        sessionId: event.sessionId
      })

    case 'tool-call':
      return chatActions.stepReceived({
        detail: event.detail,
        messageId: event.messageId,
        name: event.name,
        sessionId: event.sessionId
      })
  }
}
