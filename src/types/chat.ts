export interface ChatMessageRecord {
  content: string
  createdAt: string
  errorMessage: string | null
  eventsJson: string | null
  id: string
  pullRequestId: string
  role: 'assistant' | 'user'
  sessionId: string
}

export interface ChatSessionRecord {
  agent: string
  agentSessionId: string | null
  createdAt: string
  id: string
  pullRequestId: string
  title: string | null
  updatedAt: string
}

export interface ChatStep {
  detail: string | null
  name: string
}

export interface ChatSendResult {
  assistantMessageId: string
  sessionId: string
  userMessage: ChatMessageRecord
}

export type ChatEvent =
  | {
      kind: 'assistant-delta'
      messageId: string
      sessionId: string
      text: string
    }
  | {
      kind: 'done'
      message: ChatMessageRecord
      sessionId: string
    }
  | {
      kind: 'error'
      message: string
      messageId: string
      sessionId: string
    }
  | {
      kind: 'tool-call'
      detail: string | null
      messageId: string
      name: string
      sessionId: string
    }
